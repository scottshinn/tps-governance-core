import type {
  EvaluationContext,
  NoAccessToResourceTypeCondition,
  RuleEvaluator,
  RuleResult,
} from '../types';
import type { Rule } from '../../client/types';

/**
 * Fails when any agent (other than those holding a role in `except_roles`)
 * has an `allow` permission whose resource is of the configured type.
 */
export const noAccessToResourceTypeEvaluator: RuleEvaluator = {
  type: 'no_access_to_resource_type',

  async evaluate(ctx: EvaluationContext, rule: Rule): Promise<RuleResult> {
    const cond = rule.condition as NoAccessToResourceTypeCondition;
    const exceptRoles = cond.except_roles ?? [];

    const offenders = await ctx.sql<
      { agent_id: string; permission_id: string }[]
    >`
      SELECT DISTINCT a.id AS agent_id, p.id AS permission_id
      FROM governance.agents a
      JOIN governance.agent_role_assignments ara ON ara.agent_id = a.id
        AND ara.status = 'active'
        AND (ara.expires_at IS NULL OR ara.expires_at > now())
      JOIN governance.roles r ON r.id = ara.role_id
      JOIN governance.permissions p ON p.role_id = r.id
        AND p.grant_type = 'allow'
        AND (p.expires_at IS NULL OR p.expires_at > now())
      JOIN governance.resources res ON res.id = p.resource_id
      WHERE res.resource_type = ${cond.resource_type}::governance.resource_type
        AND ${exceptRoles.length === 0
          ? ctx.sql`TRUE`
          : ctx.sql`r.name <> ALL(${exceptRoles})`}
        AND ${ctx.agentId ? ctx.sql`a.id = ${ctx.agentId}` : ctx.sql`TRUE`}
    `;

    const passed = offenders.length === 0;
    const agentIds = Array.from(new Set(offenders.map((o) => o.agent_id)));
    const permIds = offenders.map((o) => o.permission_id);

    return {
      rule_id: rule.id,
      rule_name: rule.name,
      passed,
      severity: rule.severity,
      violation_action: rule.violation_action,
      details: passed
        ? `No unauthorized agents have allow permissions on ${cond.resource_type} resources.`
        : `${agentIds.length} agent(s) hold allow permissions on ${cond.resource_type} resources outside the permitted role set.`,
      affected_entities: passed
        ? {}
        : { agent_ids: agentIds, permission_ids: permIds },
    };
  },
};
