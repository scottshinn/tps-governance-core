import type { EvaluationContext, RuleEvaluator, RuleResult } from '../types';
import type { Rule } from '../../client/types';

/**
 * Fails when a sub-agent's effective allow permissions extend beyond its
 * parent's `delegation_scope`. The schema's `delegation_scope` is jsonb;
 * we interpret the scope as `{ resource_ids?: string[], actions?: string[] }`
 * — sub-agent permissions referencing resources or actions outside that
 * envelope flag a violation.
 *
 * When `delegation_scope` is null, the parent has not declared a scope and
 * the rule cannot evaluate — the sub-agent is reported as `inherits_unbounded`.
 */
export const delegationScopeEnforcementEvaluator: RuleEvaluator = {
  type: 'delegation_scope_enforcement',

  async evaluate(ctx: EvaluationContext, rule: Rule): Promise<RuleResult> {
    const offenders: { agent_id: string; reason: string; permission_ids: string[] }[] = [];

    const subAgents = await ctx.sql<
      { id: string; parent_agent_id: string; delegation_scope: Record<string, unknown> | null }[]
    >`
      SELECT a.id, a.parent_agent_id, p.delegation_scope
      FROM governance.agents a
      JOIN governance.agents p ON p.id = a.parent_agent_id
      WHERE a.parent_agent_id IS NOT NULL
        AND a.lifecycle_state IN ('active', 'approved')
        AND ${ctx.agentId ? ctx.sql`a.id = ${ctx.agentId}` : ctx.sql`TRUE`}
    `;

    for (const sa of subAgents) {
      const scope = sa.delegation_scope;
      if (!scope) {
        offenders.push({
          agent_id: sa.id,
          reason: 'parent_unbounded',
          permission_ids: [],
        });
        continue;
      }

      const allowedResources = (scope.resource_ids as string[] | undefined) ?? null;
      const allowedActions = (scope.actions as string[] | undefined) ?? null;

      const perms = await ctx.sql<
        { permission_id: string; resource_id: string; actions: string[] }[]
      >`
        SELECT p.id AS permission_id, p.resource_id, p.actions::text[] AS actions
        FROM governance.agent_role_assignments ara
        JOIN governance.permissions p ON p.role_id = ara.role_id
          AND p.grant_type = 'allow'
          AND (p.expires_at IS NULL OR p.expires_at > now())
        WHERE ara.agent_id = ${sa.id}
          AND ara.status = 'active'
          AND (ara.expires_at IS NULL OR ara.expires_at > now())
      `;

      for (const p of perms) {
        const resourceOk =
          allowedResources === null || allowedResources.includes(p.resource_id);
        const actionsOk =
          allowedActions === null || p.actions.every((a) => allowedActions.includes(a));
        if (!resourceOk || !actionsOk) {
          const existing = offenders.find((o) => o.agent_id === sa.id);
          if (existing) existing.permission_ids.push(p.permission_id);
          else
            offenders.push({
              agent_id: sa.id,
              reason: 'exceeds_scope',
              permission_ids: [p.permission_id],
            });
        }
      }
    }

    const passed = offenders.length === 0;
    return {
      rule_id: rule.id,
      rule_name: rule.name,
      passed,
      severity: rule.severity,
      violation_action: rule.violation_action,
      details: passed
        ? 'Every sub-agent stays within its parent delegation scope.'
        : `${offenders.length} sub-agent(s) violate delegation scope (${summarize(offenders)}).`,
      affected_entities: passed
        ? {}
        : {
          agent_ids: offenders.map((o) => o.agent_id),
          permission_ids: Array.from(
            new Set(offenders.flatMap((o) => o.permission_ids))
          ),
        },
    };
  },
};

function summarize(items: { reason: string }[]): string {
  const counts: Record<string, number> = {};
  for (const o of items) counts[o.reason] = (counts[o.reason] ?? 0) + 1;
  return Object.entries(counts)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
}
