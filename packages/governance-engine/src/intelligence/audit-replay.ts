import type { Sql } from '../client/connection';
import { withTpsReadOnly } from '../client/connection';
import type {
  Agent,
  AgentRoleAssignment,
  AuditLogEntry,
  EffectivePermission,
  Permission,
  Role,
  TpsContext,
} from '../client/types';
import { computeNetPermissions } from './effective-permissions';
import type { NetPermission } from '../client/types';

export interface PointInTimeQuery {
  entity_type: string;
  entity_id: string;
  as_of: Date;
}

export interface PointInTimeResult<T> {
  entity_type: string;
  entity_id: string;
  as_of: Date;
  state: T | null;
  reconstructed_from: {
    audit_events_count: number;
    earliest_event: Date | null;
    latest_event_before_as_of: Date | null;
  };
}

export interface AgentPointInTimeAccess {
  agent: Agent | null;
  assignments: AgentRoleAssignment[];
  /** Roles in scope at the timestamp, including parents up to depth 20. */
  roles: Role[];
  permissions: Permission[];
  effective: EffectivePermission[];
  net: NetPermission[];
}

/**
 * Replays the audit log to answer point-in-time questions like "what could
 * agent X do last Tuesday?" (D004). Expensive — every reachable assignment,
 * role, and permission requires a scan over `audit_log`.
 */
export class AuditReplayApi {
  constructor(private readonly sql: Sql) {}

  /**
   * Reconstruct a single entity's state at `as_of`. Returns null state when
   * the entity didn't exist (no INSERT before `as_of`) or had been deleted.
   */
  async reconstruct<T>(
    ctx: TpsContext,
    query: PointInTimeQuery
  ): Promise<PointInTimeResult<T>> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const events = await tx<AuditLogEntry[]>`
        SELECT * FROM governance.audit_log
        WHERE entity_type = ${query.entity_type}
          AND entity_id = ${query.entity_id}
          AND occurred_at <= ${query.as_of}
        ORDER BY occurred_at DESC
      `;
      const summary = {
        audit_events_count: events.length,
        earliest_event: events.length > 0 ? events[events.length - 1].occurred_at : null,
        latest_event_before_as_of: events[0]?.occurred_at ?? null,
      };
      if (events.length === 0) {
        return {
          entity_type: query.entity_type,
          entity_id: query.entity_id,
          as_of: query.as_of,
          state: null,
          reconstructed_from: summary,
        };
      }
      const latest = events[0];
      // The audit_action_type enum names every delete action with a verb
      // ending in `_revoked`, `_decommissioned`, `_deleted`, or `_disabled`.
      // We rely on `new_state` instead — null new_state on a DELETE means
      // the entity was destroyed; otherwise the snapshot is the state.
      const state = (latest.new_state as T | null) ?? null;
      return {
        entity_type: query.entity_type,
        entity_id: query.entity_id,
        as_of: query.as_of,
        state,
        reconstructed_from: summary,
      };
    });
  }

  /**
   * Reconstruct an agent's effective access at `as_of`. Walks the audit log
   * for the agent, every active assignment at `as_of`, the roles those
   * assignments referenced (including parent chain), and every permission
   * those roles held — then computes net effective access.
   *
   * Caveats:
   * - Role parent_role_id is reconstructed at `as_of` using the same
   *   point-in-time logic; if a role's parent changed after `as_of`, the
   *   chain reflects the prior parent.
   * - The audit log captures all 17 mutable tables, so deletes are
   *   visible. Assignments whose latest `new_state` is null are excluded.
   * - Expired permissions at `as_of` are excluded by checking `expires_at`
   *   against `as_of`, not the database `now()`.
   */
  async agentAccessAsOf(
    ctx: TpsContext,
    agent_id: string,
    as_of: Date
  ): Promise<AgentPointInTimeAccess> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const [agentEvents] = [
        await tx<AuditLogEntry[]>`
          SELECT * FROM governance.audit_log
          WHERE entity_type = 'governance.agents'
            AND entity_id = ${agent_id}
            AND occurred_at <= ${as_of}
          ORDER BY occurred_at DESC
          LIMIT 1
        `,
      ];
      const agent =
        agentEvents.length > 0 && agentEvents[0].new_state
          ? (agentEvents[0].new_state as unknown as Agent)
          : null;
      if (!agent) {
        return { agent: null, assignments: [], roles: [], permissions: [], effective: [], net: [] };
      }

      // Latest event per assignment touching this agent.
      const assignmentRows = await tx<{ entity_id: string; new_state: AgentRoleAssignment | null }[]>`
        SELECT DISTINCT ON (entity_id)
          entity_id, new_state
        FROM governance.audit_log
        WHERE entity_type = 'governance.agent_role_assignments'
          AND occurred_at <= ${as_of}
          AND ((previous_state->>'agent_id') = ${agent_id} OR (new_state->>'agent_id') = ${agent_id})
        ORDER BY entity_id, occurred_at DESC
      `;
      const assignments: AgentRoleAssignment[] = [];
      for (const row of assignmentRows) {
        if (!row.new_state) continue;
        const a = row.new_state;
        if (a.agent_id !== agent_id) continue;
        if (a.status !== 'active') continue;
        if (a.expires_at && new Date(a.expires_at) <= as_of) continue;
        assignments.push(a);
      }

      // Reconstruct roles and walk the parent chain.
      const visited = new Set<string>();
      const roleQueue = assignments.map((a) => a.role_id);
      const roles: Role[] = [];
      let depth = 0;
      while (roleQueue.length > 0 && depth <= 20) {
        const batch = roleQueue.splice(0, roleQueue.length);
        for (const role_id of batch) {
          if (visited.has(role_id)) continue;
          visited.add(role_id);
          const [evt] = await tx<AuditLogEntry[]>`
            SELECT * FROM governance.audit_log
            WHERE entity_type = 'governance.roles'
              AND entity_id = ${role_id}
              AND occurred_at <= ${as_of}
            ORDER BY occurred_at DESC
            LIMIT 1
          `;
          const role = evt?.new_state as unknown as Role | null;
          if (!role) continue;
          roles.push(role);
          if (role.parent_role_id && !visited.has(role.parent_role_id)) {
            roleQueue.push(role.parent_role_id);
          }
        }
        depth += 1;
      }

      const roleIds = roles.map((r) => r.id);
      let permRows: { entity_id: string; new_state: Permission | null }[] = [];
      if (roleIds.length > 0) {
        permRows = await tx<{ entity_id: string; new_state: Permission | null }[]>`
          SELECT DISTINCT ON (entity_id)
            entity_id, new_state
          FROM governance.audit_log
          WHERE entity_type = 'governance.permissions'
            AND occurred_at <= ${as_of}
            AND COALESCE(new_state->>'role_id', previous_state->>'role_id') = ANY(${roleIds})
          ORDER BY entity_id, occurred_at DESC
        `;
      }
      const permissions: Permission[] = [];
      const roleById = new Map(roles.map((r) => [r.id, r]));
      for (const row of permRows) {
        if (!row.new_state) continue;
        const p = row.new_state;
        if (!roleById.has(p.role_id)) continue;
        if (p.expires_at && new Date(p.expires_at) <= as_of) continue;
        permissions.push(p);
      }

      // Build EffectivePermission[] mirroring the database function shape.
      // role_depth is computed from the parent chain.
      const depthByRole = computeRoleDepths(roles, assignments);
      const effective: EffectivePermission[] = permissions.map((p) => {
        const role = roleById.get(p.role_id)!;
        return {
          permission_id: p.id,
          role_id: p.role_id,
          role_name: role.name,
          role_depth: depthByRole.get(p.role_id) ?? 0,
          resource_id: p.resource_id,
          tool_id: p.tool_id,
          actions: p.actions,
          conditions: p.conditions,
          grant_type: p.grant_type,
          expires_at: p.expires_at,
        };
      });

      const net = computeNetPermissions(effective);

      return { agent, assignments, roles, permissions, effective, net };
    });
  }
}

/** BFS from each direct role to compute minimum depth via parent_role_id. */
function computeRoleDepths(
  roles: Role[],
  assignments: AgentRoleAssignment[]
): Map<string, number> {
  const byId = new Map(roles.map((r) => [r.id, r]));
  const depth = new Map<string, number>();
  const queue: Array<[string, number]> = assignments.map((a) => [a.role_id, 0]);
  while (queue.length > 0) {
    const [id, d] = queue.shift()!;
    if (!byId.has(id)) continue;
    const existing = depth.get(id);
    if (existing !== undefined && existing <= d) continue;
    depth.set(id, d);
    const role = byId.get(id)!;
    if (role.parent_role_id && d < 20) {
      queue.push([role.parent_role_id, d + 1]);
    }
  }
  return depth;
}
