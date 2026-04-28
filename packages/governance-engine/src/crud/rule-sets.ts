import type { Sql } from '../client/connection';
import { withTpsContext, withTpsReadOnly } from '../client/connection';
import type {
  PaginatedResult,
  Rule,
  RuleSet,
  ScopeLevel,
  TpsContext,
} from '../client/types';
import { compact, getById, listPaginated } from '../utils/crud-helpers';
import { TpsNotFoundError, TpsValidationError } from '../utils/errors';
import { buildWhere } from '../utils/filtering';

export interface CreateRuleSetInput {
  name: string;
  description?: string | null;
  scope?: ScopeLevel;
  scope_entity_id?: string | null;
}

export interface ListRuleSetsOptions {
  scope?: ScopeLevel | ScopeLevel[];
  scope_entity_id?: string | null;
  search?: string;
  limit?: number;
  cursor?: string;
}

export type UpdateRuleSetInput = Partial<CreateRuleSetInput>;

export class RuleSetsApi {
  constructor(private readonly sql: Sql) {}

  async create(ctx: TpsContext, input: CreateRuleSetInput): Promise<RuleSet> {
    if ((input.scope ?? 'global') === 'global' && input.scope_entity_id) {
      throw new TpsValidationError(
        'global rule_sets must not set scope_entity_id',
        { name: input.name }
      );
    }
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [row] = await tx<RuleSet[]>`
        INSERT INTO governance.rule_sets ${tx(compact(input))}
        RETURNING *
      `;
      return row;
    });
  }

  async get(ctx: TpsContext, id: string): Promise<RuleSet> {
    return withTpsReadOnly(this.sql, ctx, (tx) =>
      getById<RuleSet>(tx, 'governance.rule_sets', id, 'rule_set')
    );
  }

  async list(
    ctx: TpsContext,
    opts: ListRuleSetsOptions = {}
  ): Promise<PaginatedResult<RuleSet>> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      let where = buildWhere(tx, {
        scope: opts.scope,
        scope_entity_id:
          opts.scope_entity_id === undefined ? undefined : opts.scope_entity_id,
      });
      if (opts.search) {
        const f = tx`name ILIKE ${'%' + opts.search + '%'}`;
        where = where ? tx`${where} AND ${f}` : f;
      }
      return listPaginated<RuleSet>(tx, 'governance.rule_sets', {
        where,
        cursor: opts.cursor,
        limit: opts.limit,
      });
    });
  }

  async update(
    ctx: TpsContext,
    id: string,
    patch: UpdateRuleSetInput
  ): Promise<RuleSet> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const clean = compact(patch);
      if (Object.keys(clean).length === 0) {
        return getById<RuleSet>(tx, 'governance.rule_sets', id, 'rule_set');
      }
      const rows = await tx<RuleSet[]>`
        UPDATE governance.rule_sets
        SET ${tx(clean)}, updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) throw new TpsNotFoundError('rule_set', id);
      return rows[0];
    });
  }

  async delete(ctx: TpsContext, id: string): Promise<void> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const r = await tx`DELETE FROM governance.rule_sets WHERE id = ${id}`;
      if (r.count === 0) throw new TpsNotFoundError('rule_set', id);
    });
  }

  async addRule(
    ctx: TpsContext,
    rule_set_id: string,
    rule_id: string
  ): Promise<void> {
    await withTpsContext(this.sql, ctx, async (tx) => {
      await tx`
        INSERT INTO governance.rule_set_rules (rule_set_id, rule_id)
        VALUES (${rule_set_id}, ${rule_id})
        ON CONFLICT DO NOTHING
      `;
    });
  }

  async removeRule(
    ctx: TpsContext,
    rule_set_id: string,
    rule_id: string
  ): Promise<void> {
    await withTpsContext(this.sql, ctx, async (tx) => {
      await tx`
        DELETE FROM governance.rule_set_rules
        WHERE rule_set_id = ${rule_set_id} AND rule_id = ${rule_id}
      `;
    });
  }

  async listRules(ctx: TpsContext, rule_set_id: string): Promise<Rule[]> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<Rule[]>`
        SELECT r.* FROM governance.rules r
        JOIN governance.rule_set_rules rsr ON rsr.rule_id = r.id
        WHERE rsr.rule_set_id = ${rule_set_id}
        ORDER BY r.name
      `;
      return rows;
    });
  }
}
