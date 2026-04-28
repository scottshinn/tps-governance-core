import type { Sql } from '../client/connection';
import { withTpsReadOnly } from '../client/connection';
import type {
  ComplianceFramework,
  ComplianceRequirement,
  RequirementStatus,
  Rule,
  TpsContext,
} from '../client/types';
import { BUILT_IN_EVALUATORS } from './evaluators';
import type {
  ComplianceReport,
  ComplianceRequirementReport,
  EvaluationContext,
  RuleEvaluator,
  RuleResult,
} from './types';

const SEVERITY_ORDER: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
};

/**
 * Strategy dispatcher. Looks up evaluators by `condition.type` and runs
 * them in the read-only transaction supplied by {@link withTpsReadOnly}.
 *
 * Custom evaluators registered via {@link RuleEvaluatorRegistry.register}
 * win over built-ins for the same `type` discriminant.
 */
export class RuleEvaluatorRegistry {
  private readonly evaluators = new Map<string, RuleEvaluator>();

  constructor(initial: RuleEvaluator[] = BUILT_IN_EVALUATORS) {
    for (const e of initial) this.register(e);
  }

  register(evaluator: RuleEvaluator): void {
    this.evaluators.set(evaluator.type, evaluator);
  }

  unregister(type: string): boolean {
    return this.evaluators.delete(type);
  }

  has(type: string): boolean {
    return this.evaluators.has(type);
  }

  list(): string[] {
    return Array.from(this.evaluators.keys());
  }

  get(type: string): RuleEvaluator | undefined {
    return this.evaluators.get(type);
  }
}

export interface EvaluateOptions {
  /** Limit to a single agent. Evaluators that support agent scoping use this. */
  agentId?: string;
  /** Limit to a single product. */
  productId?: string;
  /** Limit to a single resource. */
  resourceId?: string;
  /** Limit to a specific rule_set_id. */
  ruleSetId?: string;
  /** When true, also evaluate disabled/draft rules. Defaults to false. */
  includeNonActive?: boolean;
}

export interface ComplianceCheckOptions {
  framework?: string;
  frameworkId?: string;
  agentId?: string;
}

export class RulesEngine {
  readonly registry: RuleEvaluatorRegistry;

  constructor(private readonly sql: Sql, registry?: RuleEvaluatorRegistry) {
    this.registry = registry ?? new RuleEvaluatorRegistry();
  }

  /**
   * Evaluate every applicable rule. Filtering by scope is performed in SQL
   * so the dispatcher receives only candidate rules; each evaluator then
   * implements its own logic. Results are sorted by severity descending.
   */
  async evaluate(ctx: TpsContext, opts: EvaluateOptions = {}): Promise<RuleResult[]> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const includeNonActive = opts.includeNonActive ?? false;
      const rules = await tx<Rule[]>`
        SELECT * FROM governance.rules
        WHERE ${includeNonActive ? tx`TRUE` : tx`status = 'active'`}
          AND ${opts.ruleSetId
            ? tx`id IN (SELECT rule_id FROM governance.rule_set_rules WHERE rule_set_id = ${opts.ruleSetId})`
            : tx`TRUE`}
          AND ${opts.agentId
            ? tx`(scope = 'global' OR (scope = 'agent' AND scope_entity_id = ${opts.agentId})
                  OR (scope = 'product' AND scope_entity_id = (SELECT product_id FROM governance.agents WHERE id = ${opts.agentId})))`
            : tx`TRUE`}
          AND ${opts.resourceId
            ? tx`(scope = 'global' OR (scope = 'resource' AND scope_entity_id = ${opts.resourceId}))`
            : tx`TRUE`}
          AND ${opts.productId
            ? tx`(scope = 'global' OR (scope = 'product' AND scope_entity_id = ${opts.productId}))`
            : tx`TRUE`}
        ORDER BY name
      `;

      const evalCtx: EvaluationContext = {
        sql: tx,
        agentId: opts.agentId,
        productId: opts.productId,
        resourceId: opts.resourceId,
      };

      const results: RuleResult[] = [];
      for (const rule of rules) {
        const type = (rule.condition as { type?: string }).type;
        const evaluator = type ? this.registry.get(type) : undefined;
        if (!evaluator) {
          results.push({
            rule_id: rule.id,
            rule_name: rule.name,
            passed: true,
            severity: rule.severity,
            violation_action: rule.violation_action,
            details: `No evaluator registered for condition type '${type ?? '<missing>'}' — skipped.`,
            affected_entities: {},
          });
          continue;
        }
        const r = await evaluator.evaluate(evalCtx, rule);
        results.push(r);
      }

      results.sort((a, b) => {
        if (a.passed !== b.passed) return a.passed ? 1 : -1;
        return (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0);
      });
      return results;
    });
  }

  /**
   * Evaluate only the rules linked to a compliance framework's requirements
   * via `governance.rule_compliance_reqs`. Each requirement is summarized
   * as `met`, `partially_met`, `not_met`, or `not_applicable`.
   */
  async complianceCheck(
    ctx: TpsContext,
    opts: ComplianceCheckOptions
  ): Promise<ComplianceReport> {
    if (!opts.framework && !opts.frameworkId) {
      throw new Error('complianceCheck requires `framework` or `frameworkId`');
    }
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const [framework] = await tx<ComplianceFramework[]>`
        SELECT * FROM governance.compliance_frameworks
        WHERE ${opts.frameworkId
          ? tx`id = ${opts.frameworkId}`
          : tx`name = ${opts.framework}`}
        LIMIT 1
      `;
      if (!framework) {
        throw new Error(
          `Compliance framework not found: ${opts.frameworkId ?? opts.framework}`
        );
      }

      const requirements = await tx<ComplianceRequirement[]>`
        SELECT * FROM governance.compliance_requirements
        WHERE framework_id = ${framework.id}
        ORDER BY reference_code
      `;

      const requirementReports: ComplianceRequirementReport[] = [];
      const evalCtx: EvaluationContext = { sql: tx, agentId: opts.agentId };

      for (const req of requirements) {
        const linkedRules = await tx<Rule[]>`
          SELECT r.* FROM governance.rules r
          JOIN governance.rule_compliance_reqs rcr ON rcr.rule_id = r.id
          WHERE rcr.requirement_id = ${req.id}
            AND r.status = 'active'
        `;

        const ruleResults: RuleResult[] = [];
        for (const rule of linkedRules) {
          const type = (rule.condition as { type?: string }).type;
          const evaluator = type ? this.registry.get(type) : undefined;
          if (!evaluator) continue;
          ruleResults.push(await evaluator.evaluate(evalCtx, rule));
        }

        const status: RequirementStatus =
          linkedRules.length === 0
            ? 'not_applicable'
            : ruleResults.every((r) => r.passed)
              ? 'met'
              : ruleResults.some((r) => r.passed)
                ? 'partially_met'
                : 'not_met';

        requirementReports.push({
          requirement_id: req.id,
          reference_code: req.reference_code,
          description: req.description,
          status,
          rule_results: ruleResults,
        });
      }

      const overall: RequirementStatus = aggregateStatus(requirementReports);

      return {
        framework_id: framework.id,
        framework_name: framework.name,
        framework_version: framework.version,
        requirements: requirementReports,
        status: overall,
      };
    });
  }
}

function aggregateStatus(rows: ComplianceRequirementReport[]): RequirementStatus {
  if (rows.length === 0) return 'not_applicable';
  const non = rows.filter((r) => r.status !== 'not_applicable');
  if (non.length === 0) return 'not_applicable';
  if (non.every((r) => r.status === 'met')) return 'met';
  if (non.every((r) => r.status === 'not_met')) return 'not_met';
  return 'partially_met';
}
