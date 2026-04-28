# API reference — `@tpsdev/governance-engine`

The library is consumed through one entry point: [`TpsClient`](../src/client/tps-client.ts). Every operation requires a [`TpsContext`](../src/client/types.ts) — an `actor` string (recorded in the audit log per D016) and a `role` (used by RLS policies per D007).

```ts
import { TpsClient } from '@tpsdev/governance-engine';

const tps = new TpsClient({
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'governance_dev',
    username: 'postgres',
    password: 'postgres',
  },
});

const ctx = { actor: 'alice@example.com', role: 'governance_admin' as const };
```

All methods that mutate state run through `withTpsContext` (auto-applied), which:
- Begins a transaction
- `SET LOCAL tps.current_actor = ${ctx.actor}` (the trigger reads this)
- `SET LOCAL tps.role = ${ctx.role}` (RLS reads this)
- Commits on success, rolls back on error

Read-only intelligence queries additionally `SET TRANSACTION READ ONLY`.

---

## CRUD

Each domain exposes the same surface: `create`, `get`, `list`, `update`, `delete`, plus entity-specific helpers (e.g. `agents.setLifecycleState`, `assignments.revoke`, `roles.getAncestors`, `permissions.expireNow`).

| Sub-API | Entity | Notable extras |
|---|---|---|
| `tps.agents` | `governance.agents` | `findByName`, `setLifecycleState`, `listChildren` |
| `tps.products` | `governance.products` | — |
| `tps.mcpServers` | `governance.mcp_servers` | — |
| `tps.resources` | `governance.resources` | `addDataCategory`, `removeDataCategory`, `getDataCategories` |
| `tps.tools` | `governance.tools` | `attachResource`, `detachResource`, `listResources` |
| `tps.roles` | `governance.roles` | `findByName`, `getAncestors` |
| `tps.permissions` | `governance.permissions` | `expireNow` |
| `tps.assignments` | `governance.agent_role_assignments` | `revoke`, `suspend` |
| `tps.rules` | `governance.rules` | `setStatus`, `linkRequirement`, `unlinkRequirement` |
| `tps.ruleSets` | `governance.rule_sets` | `addRule`, `removeRule`, `listRules` |
| `tps.compliance` | `compliance_frameworks` + `compliance_requirements` | `getRulesForRequirement` |
| `tps.sodConstraints` | `governance.sod_constraints` | `addPermission(side)`, `setActive` |
| `tps.riskAssessments` | `governance.risk_assessments` | `latest(entity_type, entity_id)` |
| `tps.audit` | `governance.audit_log` | read-only — `list`, `forEntity` |

All `list` methods return `{ items, next_cursor }` with cursor-based pagination (no OFFSET — see `src/utils/pagination.ts`). Default page size 50, max 500.

### Errors

Postgres errors are wrapped:
- `23505` → `TpsConflictError`
- `23503` → `TpsDependencyError`
- `23502` / `23514` / `22P02` → `TpsValidationError`
- `42501` → `TpsPermissionError`
- Missing rows → `TpsNotFoundError`

---

## Intelligence — `tps.intelligence`

```ts
const raw       = await tps.intelligence.rawEffectivePermissions(ctx, agentId);
const net       = await tps.intelligence.netEffectivePermissions(ctx, agentId);
const sod       = await tps.intelligence.sodCheck(ctx, agentId);
const blast     = await tps.intelligence.blastRadius(ctx, agentId);
const overlap   = await tps.intelligence.permissionOverlap(ctx, resourceId);
const gaps      = await tps.intelligence.coverageGaps(ctx);
const tools     = await tps.intelligence.toolInventory(ctx, agentId);

// Risk scoring
const computed  = await tps.intelligence.computeRiskScore(ctx, agentId);   // façade — pure compute
const persisted = await tps.intelligence.risk.scoreAndPersist(ctx, agentId); // writes risk_assessments

// Point-in-time replay
const past      = await tps.intelligence.auditReplay.agentAccessAsOf(ctx, agentId, new Date('2026-01-01'));
```

### `netEffectivePermissions` — D002 + D024

The database returns raw `allow` and `deny` grants. This library:
1. Groups by `(resource_id, tool_id)`.
2. Within each group, unions allow.actions and deny.actions.
3. Computes `net = allowed − denied`.
4. **Broader-deny wins**: a `tool_id IS NULL` deny on a resource overrides every specific-tool allow on that same resource.
5. Records `grant_lineage` so callers can trace each action to the role and depth that granted or denied it.

Pure — `computeNetPermissions(grants)` is exposed for unit testing.

### Risk scoring — `tps.intelligence.risk`

The default config (`DEFAULT_RISK_CONFIG`) maps factors to weights per CLAUDE.md Feature 6. `score = max(triggered factor weights)` — a single critical factor dominates rather than additive accumulation. Tunable via `score(ctx, id, { config: { weights: {...}, thresholds: {...} } })`.

Factors evaluated:
- `unrestricted_admin_access` — admin with no tool scope
- `destructive_tool_access`, `pii_data_access`, `critical_resource_access`
- `high_blast_radius`, `deep_delegation_chain`
- `sod_violation`, `overdue_review`
- `broad_role_assignment`, `expired_permissions_present`, `no_governing_rules`

---

## Rules engine — `tps.rulesEngine` (or façade `tps.rules`)

```ts
// Engine-native
const results  = await tps.rulesEngine.evaluate(ctx);
const forAgent = await tps.rulesEngine.evaluate(ctx, { agentId });
const gdpr     = await tps.rulesEngine.complianceCheck(ctx, { framework: 'GDPR' });

// KYA façade — same calls via the CRUD api object
const a = await tps.rules.evaluate(ctx, agentId);                       // string → { agentId }
const b = await tps.rules.evaluate(ctx, { ruleSetId });                 // options form
const c = await tps.rules.complianceCheck(ctx, { framework: 'GDPR' });
```

Strategy dispatcher: each `condition.type` maps to a registered evaluator. The eight built-ins are documented in [RULE-CONDITIONS.md](./RULE-CONDITIONS.md). Register custom evaluators with:

```ts
tps.rulesEngine.registry.register({
  type: 'my_custom_check',
  async evaluate(ctx, rule) { /* ... */ }
});
```

Compliance reports aggregate per-requirement status:
- `met` — every linked rule passes
- `partially_met` — some linked rules pass
- `not_met` — every linked rule fails
- `not_applicable` — no rules linked

---

## Sanna export — `tps.export.sanna`

```ts
const result = await tps.export.toSannaConstitution(ctx, agentId);
// { yaml, policy_hash, constitution, metadata }
```

`policy_hash` is the SHA-256 of the canonical YAML. Mapping rules in [SANNA-EXPORT.md](./SANNA-EXPORT.md). The library does NOT sign — Ed25519 signing is Sanna's responsibility.

---

## Closing the client

```ts
await tps.close();   // ends the pool when the client owns it
```

When `TpsClient` was constructed with `{ sql: existingSqlInstance }`, ownership stays with the caller and `close()` is a no-op.
