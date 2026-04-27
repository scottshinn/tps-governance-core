# Layer 1 Improvements — Pre-Layer 2 Hardening

Read `CLAUDE.md` and `docs/` first to restore context. Then execute the following improvements in order.

## 1. Add `agent_tool_inventory` Function

Create a new governance intelligence function `governance.agent_tool_inventory(p_agent_id uuid)` that answers: "Which tools can this agent use, and what can each tool do?"

This will be one of the most-called functions in Layer 3 (the KYA control plane) — when an operator hovers over an agent, they need to see its tool inventory immediately.

**Returns:** `TABLE (tool_id uuid, tool_name text, tool_type governance.tool_type, mcp_server_id uuid, mcp_server_name text, is_destructive boolean, is_idempotent boolean, resource_count bigint, effective_actions governance.action_type[], granted_via_role_name text, granted_via_role_depth integer)`

**Logic:**
1. Call `effective_permissions(p_agent_id)` to get all allow grants (filter out deny)
2. Extract distinct tools from permissions that have a non-null `tool_id`
3. For each tool, join to `governance.tools` for tool metadata
4. Join to `governance.mcp_servers` for server name (LEFT JOIN, nullable)
5. Count resources per tool via `governance.tool_resources`
6. Aggregate the effective actions across all permissions that reference this tool
7. Include the granting role name and depth (use the shallowest/most direct grant)

**Files to create:**
- `deploy/schemas/governance/functions/agent_tool_inventory.sql`
- `verify/schemas/governance/functions/agent_tool_inventory.sql`
- `revert/schemas/governance/functions/agent_tool_inventory.sql`

**Add to `pgpm.plan`** with dependency on the `effective_permissions` function and all referenced tables.

**Use `LANGUAGE sql`** — this is a read-only query that benefits from inlining (see D017).

**Add `COMMENT ON FUNCTION`** documenting inputs, outputs, and the fact that this only returns tools from allow grants (deny-excluded tools are not shown).

---

## 2. Add `agent_tool_inventory` View

Create `governance.agent_tool_summary` view that shows all active/approved agents with their tool counts and destructive tool flags. This is the dashboard companion to the function.

**Columns:** `agent_id, agent_name, agent_type, lifecycle_state, total_tools, destructive_tools, mcp_servers_used, tool_names (text[])`

**Files to create:**
- `deploy/schemas/governance/views/agent_tool_summary.sql`
- `verify/schemas/governance/views/agent_tool_summary.sql`
- `revert/schemas/governance/views/agent_tool_summary.sql`

**Add to `pgpm.plan`** with dependency on `agent_tool_inventory` function.

---

## 3. Write Missing Tests

Create the four missing test files tracked in CLAUDE.md Build Status:

### `__tests__/permission_overlap.test.ts`
Test `governance.permission_overlap(resource_id)`:
- Create two agents with different roles that both have allow permissions on the same resource → both should appear in results
- Create an agent with a deny on the resource → should NOT appear (only allow grants count)
- Create an agent with an expired assignment → should NOT appear
- Test with a resource that has no permissions → empty result

### `__tests__/coverage_gaps.test.ts`
Test `governance.coverage_gaps()`:
- Create a resource with no permissions and no rules → should appear
- Create a resource with an active permission but no rule → should appear (missing rule coverage)
- Create a resource with an active rule but no permission → should appear (missing permission coverage)
- Create a resource with both an active permission and an active resource-scoped rule → should NOT appear
- Verify ordering by sensitivity descending

### `__tests__/rls_policies.test.ts`
Test RLS enforcement on `governance.agents` and `governance.audit_log`:
- With `tps.role = 'system_admin'` → can see all agents, can see audit log
- With `tps.role = 'auditor'` → can see all agents (SELECT), can see audit log, cannot INSERT/UPDATE/DELETE agents
- With `tps.role = 'agent_operator'` → can see only active/approved agents, cannot see audit log
- With `tps.role = 'read_only_observer'` → can see only active agents, cannot see audit log
- With no `tps.role` set → can see nothing (RLS blocks all)
- Verify audit trigger still fires (SECURITY DEFINER) even when caller has restricted RLS access

### `__tests__/permissions.test.ts`
Test permission grant/deny mechanics:
- An allow permission grants access → appears in `effective_permissions` with `grant_type = 'allow'`
- A deny permission on the same resource → appears in `effective_permissions` with `grant_type = 'deny'`
- An expired permission (`expires_at < now()`) → does NOT appear in `effective_permissions`
- A permission with `tool_id = NULL` → applies to the resource regardless of tool
- A permission with a specific `tool_id` → only applies to that tool path
- Verify the `actions` array constraint (must be non-empty)

Use the pgsql-test patterns documented in `docs/PGPM-CONVENTIONS.md`: `getConnections()`, `pg`/`db` dual connections, `beforeEach`/`afterEach` savepoint isolation, `maxWorkers: 1`.

---

## 4. Update Documentation

### Update `docs/DATA-MODEL-REFERENCE.md`
Add the `agent_tool_inventory` function and `agent_tool_summary` view to the Functions and Views sections, following the existing format.

### Update `docs/ARCHITECTURE.md`
Add `agent_tool_inventory` to the governance intelligence function table. Update the views table with `agent_tool_summary`.

### Update `CLAUDE.md` Build Status
- Move `permission_overlap.test.ts`, `coverage_gaps.test.ts`, `rls_policies.test.ts`, `permissions.test.ts` from "Missing tests" to "Done" after writing them
- Add `agent_tool_inventory` function and `agent_tool_summary` view to the Done list
- Total deploy count should increase from 40 to 42

### Add Decision D025
Add to `DECISIONS.md`:

**D025 — agent_tool_inventory as a Separate Function (Not Derived from blast_radius)**

Decision: Create `agent_tool_inventory()` as an independent function rather than deriving tool data from `blast_radius()`.

Alternatives considered:
- Parse tool data out of `blast_radius()` results (the `access_paths` column contains tool references)
- Create a view that filters `effective_permissions()` to non-null tool_id rows
- Dedicated function with tool-centric return type (chosen)

Rationale: `blast_radius()` is resource-centric — it answers "what resources can this agent reach?" The tool inventory question is tool-centric — "what tools does this agent have, and what can each tool do?" Deriving one from the other forces the caller to reshape the data. A dedicated function with a tool-oriented return type maps directly to the KYA control plane's hover-over-agent display, reducing Layer 2/3 complexity. The function reuses `effective_permissions()` internally, so there's no duplicated role-hierarchy logic.

---

## 5. Deploy Validation (if Docker/Postgres is available)

If the local Postgres container is running:

```bash
pgpm deploy --createdb --database governance_dev
pgpm verify --database governance_dev
pnpm test
pgpm revert --database governance_dev
```

Report results. If any verify scripts or tests fail, fix them before finishing.

If Docker is not available, skip this step — we'll validate in the next session.
