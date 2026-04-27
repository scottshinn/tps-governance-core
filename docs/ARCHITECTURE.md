# TPS Governance Core — Architecture

## What This Is

TPS (Tool Permission System) is a governance data layer for AI agent deployments. Layer 1 — this module — is a PostgreSQL schema that models the full permission, access, and compliance surface of an AI agent deployment as normalized relational data.

The core question TPS answers: **"Across all of my agents, tools, and resources — who can do what, why are they allowed to, and where are the gaps?"**

TPS is not an enforcement engine. Enforcement is Sanna's job. TPS is the management and authoring layer: modeling what the rules should be, who holds what permissions, and where the governance gaps are.

---

## Three-Layer Architecture

```
Layer 3 — TPS KYA (future)
  Visual "Know Your Agent" control plane
  Terminal-like GUI showing agents, topology, permissions, I/O surface

Layer 2 — @tpsdev/governance-engine (future)
  TypeScript query and analysis engine
  Runs overlap detection, SoD validation, risk scoring, governance intelligence
  Optionally exports Sanna-compatible YAML constitutions

Layer 1 — @tpsdev/governance-core (this module)
  PostgreSQL schema: tables, indexes, functions, views, triggers, seed data
  Source of truth for all governance state
```

Layer 1 must be designed so Layers 2 and 3 can be built on top without schema changes. The data model is the product at this layer.

---

## Domain Model — Entity Groups

### Group 1: Access Control (the permission lattice)

```
products ──< agents >──< agent_role_assignments >── roles
                                                       │
resources ──< permissions >────────────────────────────┘
    │              │
    └── tools ─────┘
        │
        └── mcp_servers
```

The permission lattice answers: **"What can agent X do?"**

- An **agent** has zero or more **roles** (via `agent_role_assignments`)
- A **role** has zero or more **permissions**
- A **permission** binds a role to a resource (optionally through a specific tool) with a set of allowed actions
- **Roles** form a hierarchy via `parent_role_id` — a child role inherits all ancestor permissions
- **Agents** form a hierarchy via `parent_agent_id` — orchestrators spawn sub-agents

The effective permissions for an agent = union of all permissions reachable through the role hierarchy, with explicit deny grants overriding allow grants.

### Group 2: Resource Surface (the I/O model)

```
resources >──< resource_data_categories (data_category enum)
    │
    └──< tool_resources >── tools
                                │
                            mcp_servers
```

The resource surface answers: **"What exists that agents can touch?"**

- A **resource** is anything an agent can interact with: databases, APIs, files, queues, secrets, external services, MCP servers
- Resources carry a **sensitivity classification** (public → critical) and **supported actions** (read, write, delete, etc.)
- Resources are tagged with **data categories** (PII, PHI, financial, etc.) via a junction table
- **Tools** are the enforcement boundary — agents access resources *through* tools
- **tool_resources** maps which resources each tool touches, and with which actions — this is what `blast_radius()` uses to compute transitive access

### Group 3: Governance Rules (the policy model)

```
rules >──< rule_set_rules >── rule_sets
  │
  └──< rule_compliance_reqs >── compliance_requirements >── compliance_frameworks
```

The governance model answers: **"What are the policies, and are they being met?"**

- A **rule** is an evaluable check with a JSON condition, severity, and violation action
- Rules belong to **rule sets**, which are applied at different scopes (global, product, agent, resource)
- Rules trace to **compliance requirements** (specific articles within frameworks)
- **Compliance frameworks** are the external mandates (GDPR, EU AI Act, SOC 2, internal policy)

### Group 4: Segregation of Duties (the conflict model)

```
sod_constraints >──< sod_constraint_permissions >── permissions
                          (side='a' or 'b')
```

SoD constraints answer: **"Are there conflicting permissions that must not coexist?"**

- A **SoD constraint** declares that permission set A and permission set B must not be held simultaneously by the same entity
- The `side` column ('a' or 'b') in `sod_constraint_permissions` identifies which conflict set each permission belongs to
- Violations occur when an agent (or role, or hierarchy chain) holds at least one permission from each side

### Group 5: Operational Records (audit, risk)

```
audit_log  ← appended by audit trigger on every mutable table
risk_assessments  ← point-in-time risk scores per entity
```

- **audit_log**: immutable append-only record of every governance state change; stores JSON snapshots of previous and new state
- **risk_assessments**: computed risk scores (1–5, qualitative label) for agents, roles, or permission sets; multiple records per entity track score changes over time

---

## Key Design Principles

### 1. The Schema Enforces the Governance Model

Foreign keys and constraints *are* the governance logic. There is no way to:
- Create a permission not attached to a role
- Grant access to a resource through a tool that doesn't exist
- Have an agent-role assignment for a non-existent agent or role

`ON DELETE RESTRICT` is used everywhere governance data shouldn't silently cascade away.

### 2. Deny Overrides Allow

The `permissions.grant_type` column is either `'allow'` or `'deny'`. An explicit deny on a resource+action combination overrides any allow granted through any role in the hierarchy. The `effective_permissions()` function returns both; Layer 2 is responsible for computing the net effective access.

This models real-world governance: "all data scientists can read the analytics database, *except* the PII columns" requires explicit deny at the column level without creating exception roles.

### 3. Everything Is Auditable

Every mutable table has the `governance_private.tg_audit_log()` trigger attached. The trigger captures:
- `actor` — from `current_setting('tps.current_actor', true)` session variable
- `action_type` — enumerated event type (e.g., `'permission_granted'`)
- `entity_type` — schema-qualified table name
- `entity_id` — UUID of the affected row
- `previous_state` — JSON snapshot before the change (NULL on INSERT)
- `new_state` — JSON snapshot after the change (NULL on DELETE)

The audit log itself has no audit trigger (infinite recursion prevention). It uses RLS to restrict read access to privileged roles.

### 4. Resources Are First-Class Citizens

Resources carry enough metadata to answer governance queries without joining to application data:
- `resource_type` — what kind of thing it is
- `sensitivity` — how sensitive it is (public → critical)
- `supported_actions` — what actions make sense (a webhook supports `execute` but not `read`)
- `data_category` (via junction) — what regulated data it holds

Without rich resource metadata, you cannot answer "which agents have access to PII."

### 5. Business Logic Lives in PostgreSQL

The five governance intelligence functions live in the database so both the TypeScript SDK (Layer 2) and the Python SDK (future) get identical results without reimplementing logic:

| Function | Question It Answers |
|---|---|
| `effective_permissions(agent_id)` | What can this agent do, after resolving the full role hierarchy? |
| `sod_check(agent_id)` | Does this agent violate any SoD constraints? |
| `blast_radius(agent_id)` | If this agent is compromised, what can an attacker reach? |
| `permission_overlap(resource_id)` | Which agents have access to this resource? |
| `coverage_gaps()` | Which resources have no governance coverage? |
| `agent_tool_inventory(agent_id)` | Which tools can this agent use, and what can each tool do? |

---

## Entity Relationship Summary

```
products
  ├── agents (many per product; agents self-reference for hierarchy)
  └── resources (many per product)

mcp_servers
  └── tools (many per server)

tools >──< resources (via tool_resources; with action types)

agents >──< roles (via agent_role_assignments)
roles ──< roles (self-reference: parent_role_id for inheritance)
roles ──< permissions

permissions → resources (what resource)
permissions → tools (optional: which tool)
permissions: grant_type (allow | deny), actions[], conditions (ABAC), expires_at

compliance_frameworks
  └── compliance_requirements (many per framework)

rules → compliance_requirements (many-to-many via rule_compliance_reqs)
rules → rule_sets (many-to-many via rule_set_rules)
rules.scope_entity_id → agents | products | resources (polymorphic)

sod_constraints → compliance_requirements (why this SoD exists)
sod_constraints >──< permissions (via sod_constraint_permissions, side=a|b)

audit_log: append-only, actor + action_type + entity_type + entity_id + JSON snapshots
risk_assessments: polymorphic entity reference (entity_type + entity_id)
```

---

## Session Variables

TPS uses two PostgreSQL session variables for runtime context:

| Variable | Purpose | Example |
|---|---|---|
| `tps.current_actor` | Recorded in audit log as the actor performing governance operations | `SET LOCAL tps.current_actor = 'alice@example.com'` |
| `tps.role` | Controls RLS policy evaluation | `SET LOCAL tps.role = 'auditor'` |

Application code must set these before executing governance queries. Layer 2 is responsible for validating that the requesting user actually holds the claimed role.

---

## Governance Intelligence — Function Design

### effective_permissions(p_agent_id uuid)

Uses a recursive CTE (`role_hierarchy`) to walk the role parent chain, collecting all roles reachable from the agent's direct assignments. The CTE has a depth limit of 20 to prevent infinite recursion.

Returns one row per permission, including `role_depth` (0 = direct assignment, N = Nth-level inherited). Callers can use depth to resolve conflicts between direct and inherited permissions.

### sod_check(p_agent_id uuid)

1. Calls `effective_permissions()` to get all allow grants
2. Joins to `sod_constraint_permissions` to find which SoD constraints involve those permissions
3. Groups by constraint, collecting permissions from each side
4. Returns only constraints where both `side_a_perm_ids` and `side_b_perm_ids` are non-null (both sides held)

### blast_radius(p_agent_id uuid)

1. Calls `effective_permissions()` for direct resource access
2. For each tool in the effective permissions, queries `tool_resources` to find additional resources the tool can reach
3. Unions direct and tool-mediated access, deduplicating by resource
4. Aggregates effective actions and access paths per resource
5. Orders by sensitivity descending (most sensitive first)

### permission_overlap(p_resource_id uuid)

Iterates over all active/approved agents using `CROSS JOIN LATERAL` on `effective_permissions()`. Returns agents that have allow permissions on the specified resource, with their effective action set. Expensive query — intended for targeted investigation, not full-table scans.

### coverage_gaps()

Returns resources that lack either:
- At least one active non-expired permission referencing them (not being used via any governance-controlled access path), OR
- At least one active resource-scoped rule governing them (not being monitored by any governance rule)

Ordered by sensitivity descending.

### agent_tool_inventory(p_agent_id uuid)

1. Calls `effective_permissions()` and filters to allow grants with a non-null `tool_id`
2. For each distinct tool, selects the shallowest (most direct) granting role via `DISTINCT ON`
3. Aggregates effective actions per tool across all permissions that reference the tool
4. Joins to `governance.tools` for tool metadata and `governance.mcp_servers` for server name
5. Counts resources per tool via `governance.tool_resources`
6. Returns one row per tool ordered by name

Designed as the primary data source for the KYA Layer 3 hover-over-agent display. Only allow grants are included; tools blocked exclusively by deny grants are not shown. Uses `LANGUAGE sql` for query planner inlining (D017).

---

## Views

| View | Purpose |
|---|---|
| `agent_topology` | Recursive hierarchy with depth, ancestor chain, and display path |
| `agent_summary` | Agent with role count, latest risk score, and review overdue flag |
| `agent_tool_summary` | Approved/active agents with tool counts, destructive tool count, and tool name list |
| `resource_exposure` | Resource with data categories, active agent count, and destructive grant flags |
| `sod_violations` | All current SoD violations across active/approved agents |
| `ungoverned_resources` | Thin wrapper over `coverage_gaps()` |

---

## RLS Policy Model

RLS is enabled on `governance.agents` and `governance.audit_log`. Policies check `current_setting('tps.role', true)`:

| Role Value | agents | audit_log |
|---|---|---|
| `system_admin` | Full R/W | SELECT |
| `governance_admin` | Full R/W | SELECT |
| `auditor` | SELECT (all) | SELECT |
| `agent_operator` | SELECT (active/approved only) | — |
| `read_only_observer` | SELECT (active only) | — |

The audit trigger uses `SECURITY DEFINER` so it can INSERT into `audit_log` regardless of the caller's role.
