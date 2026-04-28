import type {
  EvaluationContext,
  MaxRoleDepthCondition,
  RuleEvaluator,
  RuleResult,
} from '../types';
import type { Rule } from '../../client/types';

/**
 * Fails when any role chain exceeds `max_depth` levels via parent_role_id.
 * Depth is measured from leaf → root.
 */
export const maxRoleDepthEvaluator: RuleEvaluator = {
  type: 'max_role_depth',

  async evaluate(ctx: EvaluationContext, rule: Rule): Promise<RuleResult> {
    const cond = rule.condition as MaxRoleDepthCondition;
    const rows = await ctx.sql<{ leaf_role_id: string; depth: number }[]>`
      WITH RECURSIVE chain AS (
        SELECT id AS leaf_role_id, id, parent_role_id, 0 AS depth
        FROM governance.roles
        UNION ALL
        SELECT c.leaf_role_id, p.id, p.parent_role_id, c.depth + 1
        FROM governance.roles p
        JOIN chain c ON p.id = c.parent_role_id
        WHERE c.depth < 20
      )
      SELECT leaf_role_id, MAX(depth)::int AS depth
      FROM chain
      GROUP BY leaf_role_id
      HAVING MAX(depth) > ${cond.max_depth}
    `;
    const passed = rows.length === 0;
    return {
      rule_id: rule.id,
      rule_name: rule.name,
      passed,
      severity: rule.severity,
      violation_action: rule.violation_action,
      details: passed
        ? `No role hierarchy exceeds ${cond.max_depth} levels.`
        : `${rows.length} role(s) sit deeper than ${cond.max_depth} levels.`,
      affected_entities: passed
        ? {}
        : { role_ids: rows.map((r) => r.leaf_role_id) },
    };
  },
};
