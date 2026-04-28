import type { Sql } from '../client/connection';
import { withTpsContext, withTpsReadOnly } from '../client/connection';
import type {
  ComplianceFramework,
  ComplianceRequirement,
  FrameworkType,
  PaginatedResult,
  RequirementStatus,
  Rule,
  TpsContext,
} from '../client/types';
import { compact, getById, listPaginated } from '../utils/crud-helpers';
import { TpsNotFoundError } from '../utils/errors';
import { buildWhere } from '../utils/filtering';

export interface CreateFrameworkInput {
  name: string;
  framework_type: FrameworkType;
  version?: string | null;
  description?: string | null;
  effective_date?: Date | null;
  review_date?: Date | null;
  source_url?: string | null;
}

export interface CreateRequirementInput {
  framework_id: string;
  reference_code: string;
  description: string;
  status?: RequirementStatus;
  notes?: string | null;
}

export class ComplianceApi {
  constructor(private readonly sql: Sql) {}

  // ---------- Frameworks ----------

  async createFramework(
    ctx: TpsContext,
    input: CreateFrameworkInput
  ): Promise<ComplianceFramework> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [row] = await tx<ComplianceFramework[]>`
        INSERT INTO governance.compliance_frameworks ${tx(compact(input))}
        RETURNING *
      `;
      return row;
    });
  }

  async getFramework(ctx: TpsContext, id: string): Promise<ComplianceFramework> {
    return withTpsReadOnly(this.sql, ctx, (tx) =>
      getById<ComplianceFramework>(
        tx,
        'governance.compliance_frameworks',
        id,
        'compliance_framework'
      )
    );
  }

  async findFrameworkByName(
    ctx: TpsContext,
    name: string,
    version?: string
  ): Promise<ComplianceFramework | null> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<ComplianceFramework[]>`
        SELECT * FROM governance.compliance_frameworks
        WHERE name = ${name}
          AND ${version === undefined ? tx`version IS NULL` : tx`version = ${version}`}
        LIMIT 1
      `;
      return rows[0] ?? null;
    });
  }

  async listFrameworks(
    ctx: TpsContext,
    opts: {
      framework_type?: FrameworkType;
      search?: string;
      limit?: number;
      cursor?: string;
    } = {}
  ): Promise<PaginatedResult<ComplianceFramework>> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      let where = buildWhere(tx, { framework_type: opts.framework_type });
      if (opts.search) {
        const f = tx`name ILIKE ${'%' + opts.search + '%'}`;
        where = where ? tx`${where} AND ${f}` : f;
      }
      return listPaginated<ComplianceFramework>(
        tx,
        'governance.compliance_frameworks',
        { where, cursor: opts.cursor, limit: opts.limit }
      );
    });
  }

  async updateFramework(
    ctx: TpsContext,
    id: string,
    patch: Partial<CreateFrameworkInput>
  ): Promise<ComplianceFramework> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const clean = compact(patch);
      if (Object.keys(clean).length === 0) {
        return getById<ComplianceFramework>(
          tx,
          'governance.compliance_frameworks',
          id,
          'compliance_framework'
        );
      }
      const rows = await tx<ComplianceFramework[]>`
        UPDATE governance.compliance_frameworks
        SET ${tx(clean)}, updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) throw new TpsNotFoundError('compliance_framework', id);
      return rows[0];
    });
  }

  async deleteFramework(ctx: TpsContext, id: string): Promise<void> {
    await withTpsContext(this.sql, ctx, async (tx) => {
      const r = await tx`DELETE FROM governance.compliance_frameworks WHERE id = ${id}`;
      if (r.count === 0) throw new TpsNotFoundError('compliance_framework', id);
    });
  }

  // ---------- Requirements ----------

  async createRequirement(
    ctx: TpsContext,
    input: CreateRequirementInput
  ): Promise<ComplianceRequirement> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [row] = await tx<ComplianceRequirement[]>`
        INSERT INTO governance.compliance_requirements ${tx(compact(input))}
        RETURNING *
      `;
      return row;
    });
  }

  async getRequirement(ctx: TpsContext, id: string): Promise<ComplianceRequirement> {
    return withTpsReadOnly(this.sql, ctx, (tx) =>
      getById<ComplianceRequirement>(
        tx,
        'governance.compliance_requirements',
        id,
        'compliance_requirement'
      )
    );
  }

  async listRequirements(
    ctx: TpsContext,
    opts: {
      framework_id?: string;
      status?: RequirementStatus;
      limit?: number;
      cursor?: string;
    } = {}
  ): Promise<PaginatedResult<ComplianceRequirement>> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const where = buildWhere(tx, {
        framework_id: opts.framework_id,
        status: opts.status,
      });
      return listPaginated<ComplianceRequirement>(
        tx,
        'governance.compliance_requirements',
        { where, cursor: opts.cursor, limit: opts.limit }
      );
    });
  }

  async updateRequirement(
    ctx: TpsContext,
    id: string,
    patch: Partial<CreateRequirementInput>
  ): Promise<ComplianceRequirement> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const clean = compact(patch);
      if (Object.keys(clean).length === 0) {
        return getById<ComplianceRequirement>(
          tx,
          'governance.compliance_requirements',
          id,
          'compliance_requirement'
        );
      }
      const rows = await tx<ComplianceRequirement[]>`
        UPDATE governance.compliance_requirements
        SET ${tx(clean)}, updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) {
        throw new TpsNotFoundError('compliance_requirement', id);
      }
      return rows[0];
    });
  }

  async deleteRequirement(ctx: TpsContext, id: string): Promise<void> {
    await withTpsContext(this.sql, ctx, async (tx) => {
      const r = await tx`DELETE FROM governance.compliance_requirements WHERE id = ${id}`;
      if (r.count === 0) throw new TpsNotFoundError('compliance_requirement', id);
    });
  }

  /** Rules that satisfy a requirement (via rule_compliance_reqs). */
  async getRulesForRequirement(
    ctx: TpsContext,
    requirement_id: string
  ): Promise<Rule[]> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<Rule[]>`
        SELECT r.* FROM governance.rules r
        JOIN governance.rule_compliance_reqs rcr ON rcr.rule_id = r.id
        WHERE rcr.requirement_id = ${requirement_id}
        ORDER BY r.name
      `;
      return rows;
    });
  }
}
