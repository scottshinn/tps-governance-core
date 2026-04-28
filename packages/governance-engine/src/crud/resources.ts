import type { Sql } from '../client/connection';
import { withTpsContext, withTpsReadOnly } from '../client/connection';
import type {
  ActionType,
  DataCategory,
  PaginatedResult,
  Resource,
  ResourceType,
  SensitivityClassification,
  TpsContext,
} from '../client/types';
import { compact, getById, listPaginated } from '../utils/crud-helpers';
import { TpsNotFoundError } from '../utils/errors';
import { buildWhere } from '../utils/filtering';

export interface CreateResourceInput {
  name: string;
  resource_type: ResourceType;
  supported_actions: ActionType[];
  description?: string | null;
  sensitivity?: SensitivityClassification;
  location?: string | null;
  owner?: string | null;
  product_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListResourcesOptions {
  resource_type?: ResourceType | ResourceType[];
  sensitivity?: SensitivityClassification | SensitivityClassification[];
  product_id?: string;
  owner?: string;
  /** Filter to resources tagged with this data category. */
  data_category?: DataCategory;
  /** Filter to resources whose `supported_actions @> [action]`. */
  has_action?: ActionType;
  search?: string;
  limit?: number;
  cursor?: string;
}

export type UpdateResourceInput = Partial<CreateResourceInput>;

export class ResourcesApi {
  constructor(private readonly sql: Sql) {}

  async create(ctx: TpsContext, input: CreateResourceInput): Promise<Resource> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [row] = await tx<Resource[]>`
        INSERT INTO governance.resources ${tx(compact(input))}
        RETURNING *
      `;
      return row;
    });
  }

  async get(ctx: TpsContext, id: string): Promise<Resource> {
    return withTpsReadOnly(this.sql, ctx, (tx) =>
      getById<Resource>(tx, 'governance.resources', id, 'resource')
    );
  }

  async list(
    ctx: TpsContext,
    opts: ListResourcesOptions = {}
  ): Promise<PaginatedResult<Resource>> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      let where = buildWhere(tx, {
        resource_type: opts.resource_type,
        sensitivity: opts.sensitivity,
        product_id: opts.product_id,
        owner: opts.owner,
      });
      if (opts.data_category) {
        const f = tx`id IN (
          SELECT resource_id FROM governance.resource_data_categories
          WHERE data_category = ${opts.data_category}
        )`;
        where = where ? tx`${where} AND ${f}` : f;
      }
      if (opts.has_action) {
        const f = tx`supported_actions @> ARRAY[${opts.has_action}]::governance.action_type[]`;
        where = where ? tx`${where} AND ${f}` : f;
      }
      if (opts.search) {
        const f = tx`name ILIKE ${'%' + opts.search + '%'}`;
        where = where ? tx`${where} AND ${f}` : f;
      }
      return listPaginated<Resource>(tx, 'governance.resources', {
        where,
        cursor: opts.cursor,
        limit: opts.limit,
      });
    });
  }

  async update(
    ctx: TpsContext,
    id: string,
    patch: UpdateResourceInput
  ): Promise<Resource> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const clean = compact(patch);
      if (Object.keys(clean).length === 0) {
        return getById<Resource>(tx, 'governance.resources', id, 'resource');
      }
      const rows = await tx<Resource[]>`
        UPDATE governance.resources
        SET ${tx(clean)}, updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) throw new TpsNotFoundError('resource', id);
      return rows[0];
    });
  }

  async delete(ctx: TpsContext, id: string): Promise<void> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const r = await tx`DELETE FROM governance.resources WHERE id = ${id}`;
      if (r.count === 0) throw new TpsNotFoundError('resource', id);
    });
  }

  // ---------- Data category junction ----------

  async addDataCategory(
    ctx: TpsContext,
    resource_id: string,
    data_category: DataCategory
  ): Promise<void> {
    await withTpsContext(this.sql, ctx, async (tx) => {
      await tx`
        INSERT INTO governance.resource_data_categories (resource_id, data_category)
        VALUES (${resource_id}, ${data_category})
        ON CONFLICT DO NOTHING
      `;
    });
  }

  async removeDataCategory(
    ctx: TpsContext,
    resource_id: string,
    data_category: DataCategory
  ): Promise<void> {
    await withTpsContext(this.sql, ctx, async (tx) => {
      await tx`
        DELETE FROM governance.resource_data_categories
        WHERE resource_id = ${resource_id} AND data_category = ${data_category}
      `;
    });
  }

  async getDataCategories(
    ctx: TpsContext,
    resource_id: string
  ): Promise<DataCategory[]> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<{ data_category: DataCategory }[]>`
        SELECT data_category FROM governance.resource_data_categories
        WHERE resource_id = ${resource_id}
        ORDER BY data_category
      `;
      return rows.map((r) => r.data_category);
    });
  }
}
