import type { Sql } from '../client/connection';
import { withTpsContext, withTpsReadOnly } from '../client/connection';
import type {
  McpAuthMethod,
  McpServer,
  McpServerStatus,
  PaginatedResult,
  TpsContext,
} from '../client/types';
import { compact, getById, listPaginated } from '../utils/crud-helpers';
import { TpsNotFoundError } from '../utils/errors';
import { buildWhere } from '../utils/filtering';

export interface CreateMcpServerInput {
  name: string;
  endpoint_url: string;
  auth_method: McpAuthMethod;
  description?: string | null;
  status?: McpServerStatus;
  metadata?: Record<string, unknown> | null;
}

export interface ListMcpServersOptions {
  status?: McpServerStatus;
  auth_method?: McpAuthMethod;
  search?: string;
  limit?: number;
  cursor?: string;
}

export type UpdateMcpServerInput = Partial<CreateMcpServerInput>;

export class McpServersApi {
  constructor(private readonly sql: Sql) {}

  async create(ctx: TpsContext, input: CreateMcpServerInput): Promise<McpServer> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [row] = await tx<McpServer[]>`
        INSERT INTO governance.mcp_servers ${tx(compact(input))}
        RETURNING *
      `;
      return row;
    });
  }

  async get(ctx: TpsContext, id: string): Promise<McpServer> {
    return withTpsReadOnly(this.sql, ctx, (tx) =>
      getById<McpServer>(tx, 'governance.mcp_servers', id, 'mcp_server')
    );
  }

  async list(
    ctx: TpsContext,
    opts: ListMcpServersOptions = {}
  ): Promise<PaginatedResult<McpServer>> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      let where = buildWhere(tx, {
        status: opts.status,
        auth_method: opts.auth_method,
      });
      if (opts.search) {
        const f = tx`name ILIKE ${'%' + opts.search + '%'}`;
        where = where ? tx`${where} AND ${f}` : f;
      }
      return listPaginated<McpServer>(tx, 'governance.mcp_servers', {
        where,
        cursor: opts.cursor,
        limit: opts.limit,
      });
    });
  }

  async update(
    ctx: TpsContext,
    id: string,
    patch: UpdateMcpServerInput
  ): Promise<McpServer> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const clean = compact(patch);
      if (Object.keys(clean).length === 0) {
        return getById<McpServer>(tx, 'governance.mcp_servers', id, 'mcp_server');
      }
      const rows = await tx<McpServer[]>`
        UPDATE governance.mcp_servers
        SET ${tx(clean)}, updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) throw new TpsNotFoundError('mcp_server', id);
      return rows[0];
    });
  }

  async delete(ctx: TpsContext, id: string): Promise<void> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const r = await tx`DELETE FROM governance.mcp_servers WHERE id = ${id}`;
      if (r.count === 0) throw new TpsNotFoundError('mcp_server', id);
    });
  }
}
