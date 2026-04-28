import type { EvaluationContext, RuleEvaluator, RuleResult } from '../types';
import type { Rule } from '../../client/types';

/**
 * Every active agent must have `review_cycle_days` set AND `last_review_at`
 * within `review_cycle_days` of now. Agents missing either side fail.
 */
export const requireReviewCycleEvaluator: RuleEvaluator = {
  type: 'require_review_cycle',

  async evaluate(ctx: EvaluationContext, rule: Rule): Promise<RuleResult> {
    const rows = await ctx.sql<{ agent_id: string; reason: string }[]>`
      SELECT id AS agent_id,
        CASE
          WHEN review_cycle_days IS NULL THEN 'no_review_cycle_set'
          WHEN last_review_at IS NULL THEN 'never_reviewed'
          WHEN (last_review_at + (review_cycle_days || ' days')::interval) < now()
            THEN 'overdue'
        END AS reason
      FROM governance.agents
      WHERE lifecycle_state = 'active'
        AND ${ctx.agentId ? ctx.sql`id = ${ctx.agentId}` : ctx.sql`TRUE`}
        AND (
          review_cycle_days IS NULL
          OR last_review_at IS NULL
          OR (last_review_at + (review_cycle_days || ' days')::interval) < now()
        )
    `;
    const passed = rows.length === 0;
    return {
      rule_id: rule.id,
      rule_name: rule.name,
      passed,
      severity: rule.severity,
      violation_action: rule.violation_action,
      details: passed
        ? 'Every active agent has a current review cycle.'
        : `${rows.length} active agent(s) need review (${summarizeReasons(rows)}).`,
      affected_entities: passed ? {} : { agent_ids: rows.map((r) => r.agent_id) },
    };
  },
};

function summarizeReasons(rows: { reason: string }[]): string {
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.reason] = (counts[r.reason] ?? 0) + 1;
  return Object.entries(counts)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
}
