import type { Sql } from '../client/connection';
import { withTpsContext, withTpsReadOnly } from '../client/connection';
import type { PaginatedResult, Product, TpsContext } from '../client/types';
import { compact, getById, listPaginated } from '../utils/crud-helpers';
import { TpsNotFoundError } from '../utils/errors';
import { buildWhere } from '../utils/filtering';

export interface CreateProductInput {
  name: string;
  owner: string;
  description?: string | null;
}

export interface ListProductsOptions {
  owner?: string;
  search?: string;
  limit?: number;
  cursor?: string;
}

export type UpdateProductInput = Partial<CreateProductInput>;

export class ProductsApi {
  constructor(private readonly sql: Sql) {}

  async create(ctx: TpsContext, input: CreateProductInput): Promise<Product> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [row] = await tx<Product[]>`
        INSERT INTO governance.products ${tx(compact(input))}
        RETURNING *
      `;
      return row;
    });
  }

  async get(ctx: TpsContext, id: string): Promise<Product> {
    return withTpsReadOnly(this.sql, ctx, (tx) =>
      getById<Product>(tx, 'governance.products', id, 'product')
    );
  }

  async list(
    ctx: TpsContext,
    opts: ListProductsOptions = {}
  ): Promise<PaginatedResult<Product>> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      let where = buildWhere(tx, { owner: opts.owner });
      if (opts.search) {
        const searchFrag = tx`name ILIKE ${'%' + opts.search + '%'}`;
        where = where ? tx`${where} AND ${searchFrag}` : searchFrag;
      }
      return listPaginated<Product>(tx, 'governance.products', {
        where,
        cursor: opts.cursor,
        limit: opts.limit,
      });
    });
  }

  async update(ctx: TpsContext, id: string, patch: UpdateProductInput): Promise<Product> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const clean = compact(patch);
      if (Object.keys(clean).length === 0) {
        return getById<Product>(tx, 'governance.products', id, 'product');
      }
      const rows = await tx<Product[]>`
        UPDATE governance.products
        SET ${tx(clean)}, updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) throw new TpsNotFoundError('product', id);
      return rows[0];
    });
  }

  async delete(ctx: TpsContext, id: string): Promise<void> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const r = await tx`DELETE FROM governance.products WHERE id = ${id}`;
      if (r.count === 0) throw new TpsNotFoundError('product', id);
    });
  }
}
