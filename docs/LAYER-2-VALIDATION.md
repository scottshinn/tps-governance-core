# Layer 2 validation + publishing plan

This document is a checklist for taking `@tpsdev/governance-engine` from "scaffolded and unit-tested" to "validated against a live database and ready to publish to npm."

The current state: 26 unit tests pass; `tsc` is clean; no integration test has ever run against a live `governance-core` schema.

---

## Prerequisites

1. Layer 1 (`governance-core`) deployed to a test database. Either:
   - **Local Docker** (recommended for CI) — `docker run -d --name tps-test-db -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:16`, then `pgpm deploy --createdb --database tps_test`
   - **Existing dev DB** — point env vars at it, run `pgpm deploy` once.
2. `governance-core` seed data loaded (`seed/reference_data.sql`) so the four built-in compliance frameworks, five built-in roles, and four SoD constraint templates exist.
3. `pgsql-test` available — already a workspace dev dep.

---

## Test infrastructure

Add to `packages/governance-engine/test/`:

### `setup.ts`

Create one shared postgres.js instance and one set of teardown hooks. Use a single fork (`vitest.config.ts` already pins to `singleFork: true`) so connection state is predictable.

```ts
import postgres from 'postgres';

export const testSql = postgres({
  host: process.env.TPS_TEST_HOST ?? 'localhost',
  port: Number(process.env.TPS_TEST_PORT ?? 5433),
  database: process.env.TPS_TEST_DB ?? 'tps_test',
  username: process.env.TPS_TEST_USER ?? 'postgres',
  password: process.env.TPS_TEST_PASSWORD ?? 'test',
  max: 4,
});

export async function closeTestSql() {
  await testSql.end({ timeout: 5 });
}
```

### `helpers/db.ts` — transaction-rollback wrapper

Each test runs in a transaction that rolls back at the end. This keeps the seed data intact and lets tests run in parallel without fixture collisions.

```ts
import postgres from 'postgres';
import { testSql } from '../setup';

class RollbackSignal extends Error {}

export function withTestTx(
  fn: (tx: postgres.TransactionSql, ctx: { actor: string; role: string }) => Promise<void>
) {
  const ctx = { actor: 'test-harness@example.com', role: 'system_admin' as const };
  return async () => {
    try {
      await testSql.begin(async (tx) => {
        await tx`SELECT set_config('tps.current_actor', ${ctx.actor}, true)`;
        await tx`SELECT set_config('tps.role', ${ctx.role}, true)`;
        await fn(tx, ctx);
        throw new RollbackSignal();
      });
    } catch (e) {
      if (!(e instanceof RollbackSignal)) throw e;
    }
  };
}
```

### Factories — `helpers/factories.ts`

Build valid entities with sensible defaults, e.g.:

```ts
export const newAgent = (overrides = {}) => ({
  name: `agent-${randomSuffix()}`,
  purpose: 'Test agent',
  agent_type: 'worker' as const,
  owner: 'test-team',
  ...overrides,
});

export const newResource = (overrides = {}) => ({
  name: `res-${randomSuffix()}`,
  resource_type: 'database' as const,
  supported_actions: ['read', 'write', 'delete'] as const,
  sensitivity: 'internal' as const,
  ...overrides,
});
```

---

## Test plan — by module

### CRUD (Track A)

One spec file per CRUD module, mirroring `governance-core/__tests__/`. Each must cover:

- **Happy path** — `create` → `get` → `update` → `delete` round trip
- **Unique constraint violation** — second create with same key throws `TpsConflictError`
- **FK violation** — referenced parent missing throws `TpsDependencyError`
- **NotFound** — `get` / `update` / `delete` of unknown id throws `TpsNotFoundError`
- **Audit trail** — after `create`, `audit_log` has one row with `actor = ctx.actor`, `action_type` per the trigger config, `previous_state IS NULL`, `new_state` non-null
- **Pagination** — insert `> default page size` rows, walk via cursor, every row appears exactly once
- **Filters** — every documented `ListOpts` field narrows results correctly

| File | Notes |
|---|---|
| `test/crud/agents.test.ts` | also exercises `findByName`, `setLifecycleState`, `listChildren`, parent-agent FK |
| `test/crud/products.test.ts` | smoke + cascade-restrict on agents/resources |
| `test/crud/mcp-servers.test.ts` | smoke + tool-attached cascade-restrict |
| `test/crud/resources.test.ts` | `addDataCategory`/`removeDataCategory`, `has_action` filter, GIN-backed `supported_actions @>` |
| `test/crud/tools.test.ts` | `mcp_tool` requires `mcp_server_id`; `attachResource`/`detachResource` |
| `test/crud/roles.test.ts` | `getAncestors` walks parent_role_id; built-in roles cannot be deleted |
| `test/crud/permissions.test.ts` | `expireNow`, allow vs deny, ABAC `conditions`, expired-permission handling |
| `test/crud/assignments.test.ts` | `revoke`/`suspend`, unique `(agent_id, role_id)`, `active_only` filter |
| `test/crud/rules.test.ts` | `condition.type` discriminant validation; scope/scope_entity_id integrity |
| `test/crud/rule-sets.test.ts` | `addRule`/`removeRule`/`listRules`, scope rules |
| `test/crud/compliance.test.ts` | framework + requirement CRUD; `getRulesForRequirement` |
| `test/crud/sod-constraints.test.ts` | `addPermission(side='a'/'b')`; `setActive` |
| `test/crud/risk-assessments.test.ts` | `latest()` returns most recent; risk_level auto-derives from score |

### Intelligence (Track B)

Each file should construct a small graph (1-3 agents, 2-5 resources, a couple of tools) and assert the result of the corresponding TS resolver matches expectations. The DB function output is the source of truth; the TS resolver layers behavior on top per CLAUDE.md.

| File | Validates |
|---|---|
| `test/intelligence/effective-permissions.db.test.ts` | `raw()` matches `governance.effective_permissions()` row-for-row; `net()` correctly resolves deny-overrides AND broader-deny across (resource, tool) groups |
| `test/intelligence/sod-analysis.test.ts` | seed an SoD constraint with two permissions on opposite sides; assign both to one agent → `check()` returns 1 row |
| `test/intelligence/blast-radius.test.ts` | direct + tool-mediated access dedupes correctly; `atOrAbove('restricted')` filters |
| `test/intelligence/permission-overlap.test.ts` | two agents on same resource → `forResource()` returns both with effective actions |
| `test/intelligence/coverage-gaps.test.ts` | resource without permissions OR rule appears; resource with both does not |
| `test/intelligence/tool-inventory.test.ts` | `forAgent()` returns one row per tool with `granted_via_role_name` matching shallowest role; deny-only tools excluded |
| `test/intelligence/risk-scoring.test.ts` | construct an agent with each factor in turn; `score()` produces expected risk_score; `scoreAndPersist()` writes a `risk_assessments` row |
| `test/intelligence/audit-replay.test.ts` | mutate an agent twice; `reconstruct()` at three timestamps returns the right snapshot; `agentAccessAsOf()` excludes assignments active only after `as_of` |

### Rule evaluators (Track C)

One per evaluator. Pattern: build a fixture that should pass, assert `passed === true`; mutate to violate, assert `passed === false` and `affected_entities` contains the right ids.

| File | Evaluator |
|---|---|
| `test/rules/evaluators/no-access-to-resource-type.test.ts` | `no_access_to_resource_type` (incl. `except_roles`) |
| `test/rules/evaluators/max-sensitive-resource-count.test.ts` | `max_sensitive_resource_count` boundary at threshold |
| `test/rules/evaluators/requires-approval-for-action.test.ts` | `requires_approval_for_action` — toggle `conditions.requires_approval` |
| `test/rules/evaluators/no-pii-output-leakage.test.ts` | `no_pii_output_leakage` — global rules don't satisfy |
| `test/rules/evaluators/max-role-depth.test.ts` | `max_role_depth` — chain of 6 fails when `max_depth: 5` |
| `test/rules/evaluators/no-unrestricted-access.test.ts` | `no_unrestricted_access` — tool_id null + admin/delete + sensitivity threshold |
| `test/rules/evaluators/require-review-cycle.test.ts` | every overdue path: missing cycle, never reviewed, expired |
| `test/rules/evaluators/delegation-scope-enforcement.test.ts` | parent unbounded; sub-agent exceeds scope; sub-agent within scope |

Plus a top-level `test/rules/engine.test.ts` covering:

- `evaluate()` skips rules whose `condition.type` has no registered evaluator (returns `passed: true` with details note)
- `evaluate()` filters by `agentId` / `productId` / `resourceId` / `ruleSetId`
- `complianceCheck()` aggregation — `met` / `partially_met` / `not_met` / `not_applicable`
- Custom evaluator registered via `registry.register()` is dispatched

### Sanna export (Track D)

`test/export/sanna-exporter.db.test.ts`:

1. Build an agent with: 1 product, 2 tools (one api_call, one custom), 3 resources (one PII, one critical, one ordinary), 2 rules (one deny+critical → halt_condition, one flag_for_review → boundary).
2. Run `toSannaConstitution`.
3. Snapshot the YAML — assert it contains every expected section (`identity`, `boundaries`, `invariants`, `authority_boundaries`, `cli_permissions`, `api_permissions`, `trust_tiers`, `halt_conditions`).
4. Modify a permission and re-export — assert `policy_hash` changed.
5. Re-run with no changes — assert `policy_hash` is byte-identical (determinism).

---

## CI wiring

Add a workflow at `.github/workflows/governance-engine.yml`:

```yaml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test }
        ports: ['5433:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -C packages/governance-core run test  # ensures Layer 1 is healthy
      - run: TPS_TEST_PORT=5433 pnpm -C packages/governance-engine run test
```

---

## Publishing checklist

Before tagging `v0.1.0`:

- [ ] All Track A/B/C/D tests pass on a clean DB
- [ ] `pnpm -C packages/governance-engine run build` clean
- [ ] `dist/` contains `.js`, `.d.ts`, and `.d.ts.map` for every public module
- [ ] `package.json` `files` field set so `npm pack` ships only `dist/` + `README.md` + `LICENSE`
- [ ] `pnpm publish --dry-run` — inspect tarball; no source maps from test/, no `.test.ts.d.ts`
- [ ] `package.json` rename to `@tpsdev/governance-engine` once the npm scope is reserved
- [ ] `peerDependencies.governance-core` updated to `@tpsdev/governance-core` once Layer 1 is published
- [ ] `CHANGELOG.md` started with v0.1.0 release notes (this is a fresh package, so the changelog starts at the surface area in `docs/API.md`)
- [ ] CLAUDE.md "Build Status — Pending" boxes ticked

---

## Known gaps to revisit

These are not blockers for v0.1.0 but should be tracked:

- **Identity claims** — Sanna constitutions support `identity_claims[]` (provider, credential_id, signature). TPS Layer 1 doesn't model this; the exporter omits the section. Fix in Layer 1 first.
- **Approval chain provenance** — Sanna's `provenance.approved_by[]` + signature. Currently TPS only stores `assigned_by` on assignments, which doesn't cover constitution-level approval. Possible future column on `agents`.
- **Tool name normalization** — Sanna's authority evaluator normalizes (NFKC + camelCase split + casefold). The exporter emits raw `tools.name`; consumers that round-trip through Sanna receipts may need to normalize during comparison.
- **Receipt ingestion** — out of scope per CLAUDE.md; would land in a separate `@tpsdev/receipt-store` module.
