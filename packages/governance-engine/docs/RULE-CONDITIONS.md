# Rule conditions catalog

Rule conditions are stored as `jsonb` with a `type` discriminant (D001). The library ships eight built-in evaluators; register your own to extend.

Each condition object is the value of `governance.rules.condition`. The `type` field selects the evaluator. The remaining fields are evaluator-specific.

---

## `no_access_to_resource_type`

Fails when any agent — except those holding a role in `except_roles` — has an `allow` permission on a resource of `resource_type`.

```json
{
  "type": "no_access_to_resource_type",
  "resource_type": "secret_store",
  "except_roles": ["system_admin"]
}
```

Fields:
- `resource_type` (required) — one of the `resource_type` enum values
- `except_roles` (optional) — list of role names whose allow grants are exempt

---

## `max_sensitive_resource_count`

Fails when any agent's allow-permission set covers more than `max_count` distinct resources at or above the configured sensitivity.

```json
{
  "type": "max_sensitive_resource_count",
  "sensitivity": "restricted",
  "max_count": 3
}
```

Fields:
- `sensitivity` (required) — sensitivity threshold (inclusive)
- `max_count` (required) — integer

---

## `requires_approval_for_action`

Fails when an `allow` permission grants `action` on a resource at or above `min_sensitivity` *without* `conditions.requires_approval = true`.

```json
{
  "type": "requires_approval_for_action",
  "action": "delete",
  "min_sensitivity": "restricted"
}
```

---

## `no_pii_output_leakage`

For every resource tagged `pii`, requires at least one **active resource-scoped** rule with `violation_action IN ('deny', 'require_approval')`. A global rule does not satisfy — coverage must be explicit per resource.

```json
{ "type": "no_pii_output_leakage" }
```

---

## `max_role_depth`

Fails when any role chain exceeds `max_depth` levels via `parent_role_id`. Depth counts edges from leaf to root.

```json
{ "type": "max_role_depth", "max_depth": 5 }
```

---

## `no_unrestricted_access`

Fails when any agent holds an `allow` permission with `tool_id IS NULL` (broad scope) and an action in `actions` (default `["admin","delete"]`) on a resource at or above `min_sensitivity`.

```json
{
  "type": "no_unrestricted_access",
  "min_sensitivity": "restricted",
  "actions": ["admin", "delete"]
}
```

---

## `require_review_cycle`

Fails when any active agent either has no `review_cycle_days` set, has never been reviewed, or its `last_review_at + review_cycle_days` is in the past.

```json
{ "type": "require_review_cycle" }
```

---

## `delegation_scope_enforcement`

Fails when a sub-agent's effective allow permissions extend beyond its parent's `delegation_scope` jsonb. The scope is interpreted as `{ resource_ids?: string[], actions?: string[] }`. A null `delegation_scope` on the parent reports `parent_unbounded`.

```json
{ "type": "delegation_scope_enforcement" }
```

---

## Custom evaluators

```ts
import type { RuleEvaluator } from '@tpsdev/governance-engine';

const noWeekendDeploys: RuleEvaluator = {
  type: 'no_weekend_deploys',
  async evaluate(ctx, rule) {
    const today = new Date().getDay();
    const passed = today !== 0 && today !== 6;
    return {
      rule_id: rule.id,
      rule_name: rule.name,
      passed,
      severity: rule.severity,
      violation_action: rule.violation_action,
      details: passed ? 'Weekday — OK' : 'Weekend — deploys blocked.',
      affected_entities: {},
    };
  },
};

tps.rulesEngine.registry.register(noWeekendDeploys);
```

The evaluator's `evaluate` receives an `EvaluationContext` with the open `TransactionSql` plus optional `agentId`, `productId`, `resourceId` scope hints.
