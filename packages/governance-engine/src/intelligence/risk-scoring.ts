import type { Sql } from '../client/connection';
import { withTpsContext, withTpsReadOnly } from '../client/connection';
import type {
  ActionType,
  Agent,
  RiskAssessment,
  RiskFactor,
  RiskLevel,
  TpsContext,
} from '../client/types';
import { RISK_LEVEL_BY_SCORE } from '../client/types';
import { TpsNotFoundError } from '../utils/errors';

import { BlastRadiusApi } from './blast-radius';
import { EffectivePermissionsApi } from './effective-permissions';
import { SodAnalysisApi } from './sod-analysis';
import { ToolInventoryApi } from './tool-inventory';

/**
 * Configuration for the automated scoring algorithm. Defaults match the
 * starter weights in CLAUDE.md Feature 6. Operators can tune via
 * `TpsClient.intelligence.scoreAgent(ctx, id, { config: {...} })`.
 */
export interface RiskScoringConfig {
  weights: Partial<Record<RiskFactorName, number>>;
  thresholds: {
    /** Resources reachable above this count → high_blast_radius. */
    high_blast_radius_resources: number;
    /** Hierarchy depth above this → deep_delegation_chain. */
    deep_delegation_depth: number;
    /** Role count above this → broad_role_assignment. */
    broad_role_count: number;
  };
}

export type RiskFactorName =
  | 'unrestricted_admin_access'
  | 'destructive_tool_access'
  | 'pii_data_access'
  | 'critical_resource_access'
  | 'high_blast_radius'
  | 'deep_delegation_chain'
  | 'sod_violation'
  | 'overdue_review'
  | 'broad_role_assignment'
  | 'expired_permissions_present'
  | 'no_governing_rules';

export const DEFAULT_RISK_CONFIG: RiskScoringConfig = {
  weights: {
    unrestricted_admin_access: 5,
    destructive_tool_access: 4,
    pii_data_access: 4,
    critical_resource_access: 4,
    high_blast_radius: 3,
    deep_delegation_chain: 3,
    sod_violation: 5,
    overdue_review: 2,
    broad_role_assignment: 3,
    expired_permissions_present: 1,
    no_governing_rules: 3,
  },
  thresholds: {
    high_blast_radius_resources: 25,
    deep_delegation_depth: 3,
    broad_role_count: 5,
  },
};

export interface RiskScoreResult {
  agent_id: string;
  risk_score: 1 | 2 | 3 | 4 | 5;
  risk_level: RiskLevel;
  factors: RiskFactor[];
  /** Set when {@link RiskScoringApi.scoreAndPersist} stored the result. */
  assessment?: RiskAssessment;
}

export interface ScoreOptions {
  config?: Partial<RiskScoringConfig>;
}

export class RiskScoringApi {
  private readonly effective: EffectivePermissionsApi;
  private readonly blast: BlastRadiusApi;
  private readonly sod: SodAnalysisApi;
  private readonly tools: ToolInventoryApi;

  constructor(private readonly sql: Sql) {
    this.effective = new EffectivePermissionsApi(sql);
    this.blast = new BlastRadiusApi(sql);
    this.sod = new SodAnalysisApi(sql);
    this.tools = new ToolInventoryApi(sql);
  }

  /** Compute the score without writing to risk_assessments. */
  async score(
    ctx: TpsContext,
    agent_id: string,
    opts: ScoreOptions = {}
  ): Promise<RiskScoreResult> {
    const config = mergeConfig(opts.config);

    const agent = await withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<Agent[]>`
        SELECT * FROM governance.agents WHERE id = ${agent_id}
      `;
      if (rows.length === 0) throw new TpsNotFoundError('agent', agent_id);
      return rows[0];
    });

    const [rawGrants, blast, sod, tools] = await Promise.all([
      this.effective.raw(ctx, agent_id),
      this.blast.compute(ctx, agent_id),
      this.sod.check(ctx, agent_id),
      this.tools.forAgent(ctx, agent_id),
    ]);

    // Side queries — depth, role count, governing rules, expired assignments.
    const meta = await withTpsReadOnly(this.sql, ctx, async (tx) => {
      const [{ depth }] = await tx<{ depth: number }[]>`
        WITH RECURSIVE chain AS (
          SELECT id, parent_agent_id, 0 AS d
          FROM governance.agents WHERE id = ${agent_id}
          UNION ALL
          SELECT a.id, a.parent_agent_id, c.d + 1
          FROM governance.agents a
          JOIN chain c ON a.id = c.parent_agent_id
          WHERE c.d < 20
        )
        SELECT COALESCE(MAX(d), 0)::int AS depth FROM chain
      `;
      const [{ role_count }] = await tx<{ role_count: number }[]>`
        SELECT COUNT(*)::int AS role_count
        FROM governance.agent_role_assignments
        WHERE agent_id = ${agent_id}
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > now())
      `;
      const [{ expired }] = await tx<{ expired: number }[]>`
        SELECT COUNT(*)::int AS expired
        FROM governance.agent_role_assignments
        WHERE agent_id = ${agent_id}
          AND status = 'active'
          AND expires_at IS NOT NULL AND expires_at <= now()
      `;
      const [{ governing }] = await tx<{ governing: number }[]>`
        SELECT COUNT(*)::int AS governing
        FROM governance.rules r
        WHERE r.status = 'active'
          AND (
            r.scope = 'global'
            OR (r.scope = 'agent' AND r.scope_entity_id = ${agent_id})
            OR (r.scope = 'product' AND r.scope_entity_id = ${agent.product_id})
          )
      `;
      return { depth, role_count, expired, governing };
    });

    const factors: RiskFactor[] = [];
    const w = config.weights;

    // unrestricted_admin_access — allow with action `admin` and tool_id null
    const unrestricted = rawGrants.filter(
      (g) =>
        g.grant_type === 'allow' &&
        g.tool_id === null &&
        (g.actions as ActionType[]).includes('admin')
    );
    if (unrestricted.length > 0) {
      factors.push({
        factor: 'unrestricted_admin_access',
        weight: w.unrestricted_admin_access ?? 0,
        description:
          'Agent has admin action with no tool scope on at least one resource.',
        details: { permission_ids: unrestricted.map((g) => g.permission_id) },
      });
    }

    // destructive_tool_access
    const destructive = tools.filter((t) => t.is_destructive);
    if (destructive.length > 0) {
      factors.push({
        factor: 'destructive_tool_access',
        weight: w.destructive_tool_access ?? 0,
        description: 'Agent can use one or more tools flagged as destructive.',
        details: { tool_ids: destructive.map((t) => t.tool_id) },
      });
    }

    // pii_data_access
    const piiResourceIds = await withTpsReadOnly(this.sql, ctx, async (tx) => {
      if (blast.length === 0) return [] as string[];
      const ids = blast.map((b) => b.resource_id);
      const rows = await tx<{ resource_id: string }[]>`
        SELECT DISTINCT resource_id FROM governance.resource_data_categories
        WHERE data_category = 'pii' AND resource_id = ANY(${ids})
      `;
      return rows.map((r) => r.resource_id);
    });
    if (piiResourceIds.length > 0) {
      factors.push({
        factor: 'pii_data_access',
        weight: w.pii_data_access ?? 0,
        description: 'Agent reaches at least one resource tagged as PII.',
        details: { resource_ids: piiResourceIds },
      });
    }

    // critical_resource_access
    const criticalResources = blast.filter((b) => b.sensitivity === 'critical');
    if (criticalResources.length > 0) {
      factors.push({
        factor: 'critical_resource_access',
        weight: w.critical_resource_access ?? 0,
        description: 'Agent reaches at least one critical-sensitivity resource.',
        details: { resource_ids: criticalResources.map((r) => r.resource_id) },
      });
    }

    // high_blast_radius
    if (blast.length > config.thresholds.high_blast_radius_resources) {
      factors.push({
        factor: 'high_blast_radius',
        weight: w.high_blast_radius ?? 0,
        description: `Agent reaches ${blast.length} resources (threshold: ${config.thresholds.high_blast_radius_resources}).`,
        details: { reachable: blast.length },
      });
    }

    // deep_delegation_chain
    if (meta.depth > config.thresholds.deep_delegation_depth) {
      factors.push({
        factor: 'deep_delegation_chain',
        weight: w.deep_delegation_chain ?? 0,
        description: `Agent sits ${meta.depth} levels deep in the orchestration hierarchy.`,
        details: { depth: meta.depth },
      });
    }

    // sod_violation
    if (sod.length > 0) {
      factors.push({
        factor: 'sod_violation',
        weight: w.sod_violation ?? 0,
        description: `Agent currently violates ${sod.length} active SoD constraint(s).`,
        details: { constraint_ids: sod.map((s) => s.constraint_id) },
      });
    }

    // overdue_review
    if (
      agent.review_cycle_days !== null &&
      agent.last_review_at !== null
    ) {
      const dueAt = new Date(agent.last_review_at);
      dueAt.setDate(dueAt.getDate() + agent.review_cycle_days);
      if (dueAt < new Date()) {
        factors.push({
          factor: 'overdue_review',
          weight: w.overdue_review ?? 0,
          description: 'Agent review is overdue.',
          details: { due_at: dueAt.toISOString() },
        });
      }
    } else if (agent.review_cycle_days !== null && agent.last_review_at === null) {
      factors.push({
        factor: 'overdue_review',
        weight: w.overdue_review ?? 0,
        description: 'Agent has a review cycle but has never been reviewed.',
      });
    }

    // broad_role_assignment
    if (meta.role_count > config.thresholds.broad_role_count) {
      factors.push({
        factor: 'broad_role_assignment',
        weight: w.broad_role_assignment ?? 0,
        description: `Agent holds ${meta.role_count} active roles.`,
        details: { role_count: meta.role_count },
      });
    }

    // expired_permissions_present
    if (meta.expired > 0) {
      factors.push({
        factor: 'expired_permissions_present',
        weight: w.expired_permissions_present ?? 0,
        description: `Agent has ${meta.expired} expired but un-revoked role assignment(s).`,
        details: { expired_assignments: meta.expired },
      });
    }

    // no_governing_rules
    if (meta.governing === 0) {
      factors.push({
        factor: 'no_governing_rules',
        weight: w.no_governing_rules ?? 0,
        description:
          'No active rules govern this agent at the global, product, or agent scope.',
      });
    }

    // Score = max factor weight (CLAUDE.md Feature 6 — single critical
    // factor dominates rather than additive accumulation).
    const max = factors.reduce((acc, f) => Math.max(acc, f.weight), 0);
    const risk_score = (Math.max(1, Math.min(5, max || 1)) as 1 | 2 | 3 | 4 | 5);

    return {
      agent_id,
      risk_score,
      risk_level: RISK_LEVEL_BY_SCORE[risk_score],
      factors,
    };
  }

  /** Compute the score and persist a row to `governance.risk_assessments`. */
  async scoreAndPersist(
    ctx: TpsContext,
    agent_id: string,
    opts: ScoreOptions = {}
  ): Promise<RiskScoreResult> {
    const result = await this.score(ctx, agent_id, opts);
    const assessment = await withTpsContext(this.sql, ctx, async (tx) => {
      const [row] = await tx<RiskAssessment[]>`
        INSERT INTO governance.risk_assessments
          (entity_type, entity_id, risk_level, risk_score, risk_factors,
           assessment_method, assessor, assessed_at)
        VALUES
          ('governance.agents', ${agent_id}, ${result.risk_level}, ${result.risk_score},
           ${JSON.stringify(result.factors) as unknown as string}::jsonb,
           'automated', ${ctx.actor}, now())
        RETURNING *
      `;
      return row;
    });
    return { ...result, assessment };
  }
}

function mergeConfig(input?: Partial<RiskScoringConfig>): RiskScoringConfig {
  if (!input) return DEFAULT_RISK_CONFIG;
  return {
    weights: { ...DEFAULT_RISK_CONFIG.weights, ...(input.weights ?? {}) },
    thresholds: { ...DEFAULT_RISK_CONFIG.thresholds, ...(input.thresholds ?? {}) },
  };
}
