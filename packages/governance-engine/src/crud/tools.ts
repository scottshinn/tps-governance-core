import type { Sql } from '../client/connection';
import { withTpsContext, withTpsReadOnly } from '../client/connection';
import type {
  ActionType,
  PaginatedResult,
  Tool,
  ToolResource,
  ToolType,
  TpsContext,
} from '../client/types';
import { compact, getById, listPaginated } from '../utils/crud-helpers';
import { TpsNotFoundError, TpsValidationError } from '../utils/errors';
import { buildWhere } from '../utils/filtering';

export interface CreateToolInput {
  name: string;
  tool_type: ToolType;
  mcp_server_id?: string | null;
  description?: string | null;
  parameters?: Record<string, unknown> | null;
  risk_profile?: string | null;
  is_idempotent?: boolean;
  is_destructive?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface ListToolsOptions {
  tool_type?: ToolType | ToolType[];
  mcp_server_id?: string | null;
  is_destructive?: boolean;
  is_idempotent?: boolean;
  search?: string;
  limit?: number;
  cursor?: string;
}

export type UpdateToolInput = Partial<CreateToolInput>;

export class ToolsApi {
  constructor(private readonly sql: Sql) {}

  async create(ctx: TpsContext, input: CreateToolInput): Promise<Tool> {
    if (input.tool_type === 'mcp_tool' && !input.mcp_server_id) {
      throw new TpsValidationError(
        'mcp_tool requires mcp_server_id',
        { tool_name: input.name }
      );
    }
    if (input.tool_type !== 'mcp_tool' && input.mcp_server_id) {
      throw new TpsValidationError(
        'non-MCP tools must not specify mcp_server_id',
        { tool_name: input.name, tool_type: input.tool_type }
      );
    }
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [row] = await tx<Tool[]>`
        INSERT INTO governance.tools ${tx(compact(input))}
        RETURNING *
      `;
      return row;
    });
  }

  async get(ctx: TpsContext, id: string): Promise<Tool> {
    return withTpsReadOnly(this.sql, ctx, (tx) =>
      getById<Tool>(tx, 'governance.tools', id, 'tool')
    );
  }

  async list(ctx: TpsContext, opts: ListToolsOptions = {}): Promise<PaginatedResult<Tool>> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      let where = buildWhere(tx, {
        tool_type: opts.tool_type,
        mcp_server_id:
          opts.mcp_server_id === undefined ? undefined : opts.mcp_server_id,
        is_destructive: opts.is_destructive,
        is_idempotent: opts.is_idempotent,
      });
      if (opts.search) {
        const f = tx`name ILIKE ${'%' + opts.search + '%'}`;
        where = where ? tx`${where} AND ${f}` : f;
      }
      return listPaginated<Tool>(tx, 'governance.tools', {
        where,
        cursor: opts.cursor,
        limit: opts.limit,
      });
    });
  }

  async update(ctx: TpsContext, id: string, patch: UpdateToolInput): Promise<Tool> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const clean = compact(patch);
      if (Object.keys(clean).length === 0) {
        return getById<Tool>(tx, 'governance.tools', id, 'tool');
      }
      const rows = await tx<Tool[]>`
        UPDATE governance.tools
        SET ${tx(clean)}, updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) throw new TpsNotFoundError('tool', id);
      return rows[0];
    });
  }

  async delete(ctx: TpsContext, id: string): Promise<void> {
    return withTpsContext(this.sql, ctx, async (tx) => {
      const r = await tx`DELETE FROM governance.tools WHERE id = ${id}`;
      if (r.count === 0) throw new TpsNotFoundError('tool', id);
    });
  }

  // ---------- tool_resources junction ----------

  async attachResource(
    ctx: TpsContext,
    tool_id: string,
    resource_id: string,
    actions: ActionType[]
  ): Promise<ToolResource> {
    if (actions.length === 0) {
      throw new TpsValidationError('actions must be non-empty', { tool_id, resource_id });
    }
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [row] = await tx<ToolResource[]>`
        INSERT INTO governance.tool_resources (tool_id, resource_id, actions)
        VALUES (${tool_id}, ${resource_id}, ${actions as unknown as string[]}::governance.action_type[])
        ON CONFLICT (tool_id, resource_id) DO UPDATE
          SET actions = EXCLUDED.actions
        RETURNING *
      `;
      return row;
    });
  }

  async detachResource(
    ctx: TpsContext,
    tool_id: string,
    resource_id: string
  ): Promise<void> {
    await withTpsContext(this.sql, ctx, async (tx) => {
      await tx`
        DELETE FROM governance.tool_resources
        WHERE tool_id = ${tool_id} AND resource_id = ${resource_id}
      `;
    });
  }

  async listResources(ctx: TpsContext, tool_id: string): Promise<ToolResource[]> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<ToolResource[]>`
        SELECT * FROM governance.tool_resources WHERE tool_id = ${tool_id}
      `;
      return rows;
    });
  }
}
