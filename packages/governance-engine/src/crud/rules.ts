import type { Sql } from '../client/connection';
import { withTpsContext, withTpsReadOnly } from '../client/connection';
import type {
  PaginatedResult,
  Rule,
  RuleCondition,
  RuleStatus,
  RuleType,
  ScopeLevel,
  Severity,
  TpsContext,
  ViolationAction,
} from '../client/types';
import type {
  ComplianceCheckOptions,
  EvaluateOptions,
  RulesEngine,
} from '../rules/rule-evaluator';
import type { ComplianceReport, RuleResult } from '../rules/types';
import { compact, getById, listPaginated } from '../utils/crud-helpers';
import { TpsNotFoundError, TpsValidationError } from '../utils/errors';
import { buildWhere } from '../utils/filtering';

export interface CreateRuleInput {
  name: string;
  rule_type: RuleType;
  condition: RuleCondition;
  description?: string | null;
  violation_action?: ViolationAction;
  severity?: Severity;
  status?: RuleStatus;
  scope?: ScopeLevel;
  scope_entity_id?: string | null;
}

export interface ListRulesOptions {
  rule_type?: RuleType | RuleType[];
  status?: RuleStatus | RuleStatus[];
  severity?: Severity | Severity[];
  scope?: ScopeLevel | ScopeLevel[];
  scope_entity_id?: string | null;
  /** Filter by condition `type` discriminant. */
  condition_type?: string;
  search?: string;
  limit?: number;
  cursor?: string;
}

export type UpdateRuleInput = Partial<CreateRuleInput>;

export class RulesApi {
  /**
   * Set by `TpsClient` after both `RulesApi` and `RulesEngine` are constructed
   * (circular construction avoided). KYA façade methods `evaluate()` and
   * `complianceCheck()` delegate here.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private engine: RulesEngine | null = null;

  constructor(private readonly sql: Sql) {}

  /** @internal — TpsClient wires this up. */
  attachEngine(engine: RulesEngine): void {
    this.engine = engine;
  }

  // ---------- KYA façades over RulesEngine ----------

  /**
   * Evaluate every applicable rule. Convenience overload: pass an `agentId`
   * string to scope to one agent (matches the KYA spec call shape
   * `tps.rules.evaluate(ctx, agentId)`); pass an options object for fuller
   * control.
   */
  evaluate(ctx: TpsContext, agentIdOrOpts: string | EvaluateOptions): Promise<RuleResult[]> {
    if (!this.engine) {
      throw new Error('RulesApi.evaluate called before engine was attached');
    }
    const opts: EvaluateOptions =
      typeof agentIdOrOpts === 'string' ? { agentId: agentIdOrOpts } : agentIdOrOpts;
    return this.engine.evaluate(ctx, opts);
  }

  complianceCheck(ctx: TpsContext, opts: ComplianceCheckOptions): Promise<ComplianceReport> {
    if (!this.engine) {
      throw new Error('RulesApi.complianceCheck called before engine was attached');
    }
    return this.engine.complianceCheck(ctx, opts);
  }

  async create(ctx: TpsContext, input: CreateRuleInput): Promise<Rule> {
    if (!input.condition || typeof input.condition.type !== 'string') {
      throw new TpsValidationError(
        'rule.condition must be an object with a string `type` discriminant (D001)',
        { rule_name: input.name }
      );
    }
    if ((input.scope ?? 'global') === 'global' && input.scope_entity_id) {
      throw new TpsValidationError(
        'global-scoped rules must not set scope_entity_id',
        { rule_name: input.name }
      );
    }
    if ((input.scope ?? 'global') !== 'global' && !input.scope_entity_id) {
      throw new TpsValidationError(
        'non-global rules must set scope_entity_id',
        { rule_name: input.name, scope: input.scope }
      );
    }
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [row] = await tx<Rule[]>`
        INSERT INTO governance.rules ${tx(compact(input))}
        RETURNING *
      `;
      return row;
    });
  }

  async get(ctx: TpsContext, id: string): Promise<Rule> {
    return withTpsReadOnly(this.sql, ctx, (tx) =>
      getById<Rule>(tx, 'governance.rules', id, 'rule')
    );
  }

  async list(ctx: TpsContext, opts: ListRulesOptions = {}): Promise<PaginatedResult<Rule>> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      let where = buildWhere(tx, {
        rule_type: opts.rule_type,
        status: opts.status,
        severity: opts.severity,
        scope: opts.scope,
        scope_entity_id:
          opts.scope_entity_id === undefined ? undefined : opts.scope_entity_id,
      });
      if (opts.condition_type) {
        const f = tx`condition->>'type' = ${opts.condition_type}`;
        where = where ? tx`${where} AND ${f}` : f;
      }
      if (opts.search) {
        const f = tx`name ILIKE ${'%' + opts.search + '%'}`;
        where = where ? tx`${where} AND ${f}` : f;
      }
      return listPaginated<Rule>(tx, 'governance.rules', {
        where,
        cursor: opts.cursor,
        limit: opts.limit,
      });
    });
  }

  async update(ctx: TpsContext, id: string, patch: UpdateRuleInput): Promise<Rule> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const clean = compact(patch);
      if (Object.keys(clean).length === 0) {
        return getById<Rule>(tx, 'governance.rules', id, 'rule');
      }
      const rows = await tx<Rule[]>`
        UPDATE governance.rules
        SET ${tx(clean)}, updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) throw new TpsNotFoundError('rule', id);
      return rows[0];
    });
  }

  async delete(ctx: TpsContext, id: string): Promise<void> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const r = await tx`DELETE FROM governance.rules WHERE id = ${id}`;
      if (r.count === 0) throw new TpsNotFoundError('rule', id);
    });
  }

  async setStatus(ctx: TpsContext, id: string, status: RuleStatus): Promise<Rule> {
    return this.update(ctx, id, { status });
  }

  // ---------- Compliance requirement junction ----------

  async linkRequirement(
    ctx: TpsContext,
    rule_id: string,
    requirement_id: string
  ): Promise<void> {
    await withTpsContext(this.sql, ctx, async (tx) => {
      await tx`
        INSERT INTO governance.rule_compliance_reqs (rule_id, requirement_id)
        VALUES (${rule_id}, ${requirement_id})
        ON CONFLICT DO NOTHING
      `;
    });
  }

  async unlinkRequirement(
    ctx: TpsContext,
    rule_id: string,
    requirement_id: string
  ): Promise<void> {
    await withTpsContext(this.sql, ctx, async (tx) => {
      await tx`
        DELETE FROM governance.rule_compliance_reqs
        WHERE rule_id = ${rule_id} AND requirement_id = ${requirement_id}
      `;
    });
  }
}
