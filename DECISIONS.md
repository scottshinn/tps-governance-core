# Architecture Decisions — TPS governance-core

## D001 — Rule Condition Representation

**Decision:** Store rule conditions as `jsonb` with a required `"type"` discriminant field.

**Alternatives considered:**
- Pure JSON (chosen)
- A mini-DSL stored as text (e.g., `agent.role_count > 5 AND resource.sensitivity = 'critical'`)
- Stored PostgreSQL expressions (`EXECUTE` at evaluation time)

**Rationale:** JSON is schema-flexible — new rule types can be added without DDL changes. The `type` field acts as a strategy discriminant that Layer 2 evaluates. The database stores the intent; the evaluation engine interprets it. Stored PG expressions would create a security risk (arbitrary SQL evaluation) and couple the schema too tightly to evaluation logic. A custom DSL would require a parser in every SDK (TypeScript + Python).

**Example condition:**
```json
{"type": "no_access_to_resource_type", "resource_type": "secret_store", "except_roles": ["system_admin"]}
{"type": "max_sensitive_resource_count", "sensitivity": "critical", "max_count": 3}
{"type": "requires_approval_for_action", "action": "delete", "min_sensitivity": "restricted"}
```

---

## D002 — Permission Inheritance Model

**Decision:** Additive with explicit deny. Deny grants override allow grants on the same resource+action combination.

**Alternatives considered:**
- Additive only (Kubernetes RBAC style — no deny)
- Additive with explicit deny (chosen)

**Rationale:** AI agent governance requires the ability to carve out exceptions — e.g., "all data-scientists can read the analytics database EXCEPT for the PII columns." Explicit deny enables this without creating separate roles for each exception. Layer 2 is responsible for computing the effective permission set (allow minus deny).

**Implication:** `effective_permissions()` returns both allow and deny rows. Callers must check `grant_type`.

---

## D003 — Agent Hierarchy Depth Limit

**Decision:** Maximum depth of 20 in the `effective_permissions()` CTE recursion.

**Alternatives considered:**
- Unbounded (risk of infinite loops on bad data)
- Maximum depth of 10 (possibly too shallow for complex multi-agent systems)
- Maximum depth of 20 (chosen)

**Rationale:** A depth of 20 accommodates deeply-nested orchestration hierarchies in complex multi-agent systems while preventing runaway recursion. A cycle guard (`NOT (a.id = ANY(h.path))`) is also included in the agent_topology view. The limit of 20 is marked with `-- ASSUMPTION:` comments and can be changed via a migration if operational needs require deeper hierarchies.

---

## D004 — Temporal Modeling

**Decision:** Soft expiration via `expires_at` timestamps, not full event sourcing or temporal tables.

**Alternatives considered:**
- Full event sourcing (every state change creates a new record, no updates)
- PostgreSQL temporal tables with `valid_from`/`valid_to` (system versioning)
- Soft expiration with `expires_at` + audit log for reconstruction (chosen)

**Rationale:** Full event sourcing would require significant complexity at every write path and is better suited to Layer 2's query engine than Layer 1's schema. The audit log provides point-in-time reconstruction capability for compliance audits ("what could Agent X do last Tuesday?") — every state change is captured as a JSON snapshot in `audit_log`. For Layer 1, `expires_at` on assignments and permissions handles time-bounded grants cleanly.

**Known gap:** Point-in-time reconstruction requires replaying the audit log, which Layer 2 must implement. The schema does not natively support `AS OF` queries.

---

## D005 — Multi-tenancy

**Decision:** No multi-tenant support in Layer 1. Single-tenant schema.

**Alternatives considered:**
- Every table has an `org_id` column (tenant-per-row)
- One database per tenant (deployment-level isolation)
- Single tenant for Layer 1 (chosen)

**Rationale:** Adding `org_id` to every table and every foreign key constraint would double the complexity of every query, every index, and every RLS policy. The governance model is complex enough without multi-tenancy. If multi-tenant support is needed, it should be introduced as a separate migration (adding `org_id` columns) after the base schema is validated. Deployment-level isolation (one database per org) is the recommended approach for initial customers.

**ASSUMPTION:** This decision should be revisited before any multi-org SaaS deployment.

---

## D006 — SoD Constraint Permission Sets

**Decision:** Use a junction table (`sod_constraint_permissions`) with a `side` column ('a' or 'b') rather than storing permission arrays in the constraint row.

**Alternatives considered:**
- Store `permission_set_a uuid[]` and `permission_set_b uuid[]` as array columns on `sod_constraints`
- Junction table with side discriminant (chosen)

**Rationale:** The junction table approach maintains referential integrity (FK to permissions, CASCADE delete) and is indexable. Array columns of UUIDs cannot have FK constraints, meaning a deleted permission would silently leave dangling IDs in the constraint definition. The junction table also makes it easy to query "which SoD constraints does permission X participate in?"

---

## D007 — RLS Session Variable Convention

**Decision:** Use `current_setting('tps.role', true)` as the session variable for RLS policy evaluation.

**Alternatives considered:**
- PostgreSQL database roles (`CREATE ROLE governance_admin`) with `SET ROLE`
- JWT claims (via `current_setting('jwt.claims.role')`)
- Session variable (chosen)

**Rationale:** Creating dedicated PostgreSQL roles for each governance role would require managing those roles outside of the pgpm module, coupling the schema to external provisioning. Session variables are simpler, work with any connection pooler (set via `SET LOCAL tps.role = 'auditor'` per transaction), and allow the application layer to control the governance role without database-level role switching.

Application code must set this variable before executing governance queries. Layer 2 is responsible for validating that the requesting user has the claimed role.

---

## D008 — Audit Log Design

**Decision:** Append-only audit log with no UPDATE or DELETE RLS policies. The audit trigger uses `SECURITY DEFINER` to bypass RLS when inserting.

**Alternatives considered:**
- Immutable table (separate tablespace, no delete privileges granted)
- Append-only by RLS convention (chosen)

**Rationale:** True immutability requires database-level configuration beyond the schema module's scope. The RLS approach (no UPDATE/DELETE policies) makes unauthorized modification invisible to normal application roles. The `SECURITY DEFINER` trigger ensures audit entries are always written regardless of the caller's role. Production deployments should additionally revoke DELETE privilege from all application roles at the database role level.

---

## D009 — coverage_gaps() Definition

**Decision:** A resource has a "coverage gap" if it lacks EITHER active permissions referencing it OR an active resource-scoped rule governing it.

**Alternatives considered:**
- Only flag resources with no permissions (access surface definition)
- Only flag resources with no rules (governance coverage definition)
- Flag resources lacking either (chosen)

**Rationale:** Both conditions represent governance gaps. A resource with permissions but no governing rules is being accessed without oversight. A resource with rules but no permissions may be orphaned (rules defined but never enforced). The union of both conditions gives the most complete picture of governance gaps.

---

## D010 — Primary Key Type

**Decision:** `uuid DEFAULT gen_random_uuid()` for all primary keys.

**Alternatives considered:**
- `bigserial` / `serial` (auto-increment integer)
- `uuid` with `gen_random_uuid()` (chosen)
- `uuid` with `uuid_generate_v7()` (time-ordered UUIDs for insert performance)

**Rationale:** UUIDs are globally unique without coordination — essential for a governance layer that may federate across deployments, replicate between databases, or be referenced by external systems (Sanna receipts, audit exports). Integers are predictable and enumerable, creating an attack surface in governance contexts. UUIDv7 was considered for insert locality benefits but requires the `uuid-ossp` extension to be at v7 support level; `gen_random_uuid()` (UUIDv4, from `pgcrypto`) is universally available and sufficient for Layer 1.

---

## D011 — String Field Type

**Decision:** Use `text` for all variable-length string fields. No `varchar(n)` unless a specific length constraint is intentional governance logic.

**Alternatives considered:**
- `varchar(255)` as a "safe default"
- `varchar(n)` with domain-appropriate lengths (e.g., `varchar(100)` for names)
- `text` everywhere (chosen)

**Rationale:** In PostgreSQL, `text` and `varchar` have identical storage characteristics — `varchar(n)` adds a length CHECK constraint with no performance benefit. Arbitrary length limits (`varchar(255)`) are cargo-culted from MySQL. In a governance schema, if a length limit is meaningful (e.g., agent names must fit in a display field), it should be a documented constraint with a rationale — not a silent type default. The `citext` extension is used where case-insensitive comparison is needed (email addresses in audit log actor fields).

---

## D012 — supported_actions Array on Resources

**Decision:** `resources.supported_actions action_type[]` stores what actions are semantically valid for a resource, independent of which agents have permission to perform them.

**Alternatives considered:**
- Derive valid actions from `tool_resources` (what tools actually do to the resource)
- Derive valid actions from existing permissions (what agents are currently permitted to do)
- Explicit `supported_actions` array on the resource (chosen)

**Rationale:** `tool_resources` captures what a specific tool does to a resource — it reflects the current tool inventory, not the inherent capability of the resource. A database table supports `read`, `write`, `delete`, and `admin` regardless of which tools currently access it. Storing `supported_actions` on the resource enables governance validation ("this permission grants `delete` on a resource that only supports `read`") without requiring tool configuration to be complete first. It also enables `coverage_gaps()` and `blast_radius()` to reason about what *could* be done to a resource, not just what is currently configured.

---

## D013 — Polymorphic Risk Assessment Entity Reference

**Decision:** `risk_assessments` uses `(entity_type text, entity_id uuid)` polymorphic reference with no foreign key constraint, rather than separate tables per entity type or a union FK.

**Alternatives considered:**
- Separate tables: `agent_risk_assessments`, `role_risk_assessments`, `resource_risk_assessments`
- Nullable FKs: `agent_id uuid REFERENCES agents`, `role_id uuid REFERENCES roles`, etc. (exactly one non-null)
- Polymorphic reference with `(entity_type, entity_id)` + application-level integrity (chosen)

**Rationale:** The governance model needs risk scores for agents, roles, and potentially permissions, rule sets, or other entities. Separate tables would require a schema migration every time a new entity type needs risk assessment. Nullable FKs with a CHECK constraint (exactly one non-null) work but require N nullable columns on the table. The polymorphic pattern is used throughout the schema (audit_log, rules.scope) and is established convention in pgpm-modules. A CHECK constraint on `entity_type` bounds the allowed values. The trade-off is no DB-level referential integrity — Layer 2 must handle orphan cleanup.

---

## D014 — Single Audit Trigger Function vs Per-Table Triggers

**Decision:** One shared `governance_private.tg_audit_log()` function attached to all governed tables with table-specific action type names passed as `TG_ARGV` arguments.

**Alternatives considered:**
- Per-table trigger functions (e.g., `tg_audit_agents`, `tg_audit_permissions`) with hardcoded action types
- One generic function with `TG_TABLE_NAME` used to derive action types at runtime via a lookup
- One generic function with `TG_ARGV[0/1/2]` for INSERT/UPDATE/DELETE action types (chosen)

**Rationale:** Per-table functions would duplicate 95% of identical trigger code, creating a maintenance burden. Deriving action types from `TG_TABLE_NAME` at runtime would require a mapping table or CASE expression inside the trigger, adding latency to every write. The `TG_ARGV` approach passes the action type strings at trigger-attachment time (`CREATE TRIGGER ... EXECUTE FUNCTION tg_audit_log('agent_registered', 'agent_updated', 'agent_decommissioned')`), keeping the function generic and the action type semantics in the deployment SQL where they're easy to review.

**Trade-off:** `TG_ARGV` is positional — callers must always pass all three arguments in INSERT/UPDATE/DELETE order. Passing `NULL` for an operation that should not be audited is supported (the function skips the insert).

---

## D015 — SoD side Column Type

**Decision:** `sod_constraint_permissions.side` uses `text NOT NULL CHECK (side IN ('a', 'b'))` rather than a dedicated enum.

**Alternatives considered:**
- A `sod_side` enum type with values `('a', 'b')`
- Text with CHECK constraint (chosen)

**Rationale:** A two-value enum adds DDL overhead (an enum type must be created before the table that uses it, and enums are awkward to modify). The semantic space is fixed and will never expand — an SoD constraint always has exactly two conflict sides. A text CHECK constraint is equally expressive with less infrastructure. Adding a third value (e.g., `'c'` for a three-way conflict) would indicate a design change significant enough to warrant revisiting the whole SoD model, not just the column type.

---

## D016 — tps.current_actor Session Variable for Audit Attribution

**Decision:** The audit trigger reads the actor from `current_setting('tps.current_actor', true)` rather than from an application-layer parameter or the PostgreSQL session user.

**Alternatives considered:**
- Use `current_user` (the PostgreSQL session user who executed the query)
- Pass actor as a function parameter to every governance write function
- Session variable `tps.current_actor` (chosen)

**Rationale:** PostgreSQL session users are connection-pool identities, not application users — in a pooled environment, all requests run as the same DB user. Application-layer parameters would require every write path to go through wrapper functions that accept an actor argument, coupling the entire schema's write surface to this convention. The session variable is set once per transaction (`SET LOCAL tps.current_actor = 'alice@example.com'`) and is automatically read by all trigger invocations within that transaction. The `true` argument to `current_setting` makes the variable return NULL (not raise an error) when not set — audit entries with NULL actor are valid for system-initiated changes.

---

## D017 — Function Language Choice

**Decision:** `blast_radius()`, `permission_overlap()`, and `coverage_gaps()` use `LANGUAGE sql`. `sod_check()` uses `LANGUAGE plpgsql`. `tg_audit_log()` uses `LANGUAGE plpgsql`.

**Alternatives considered:**
- All functions in `plpgsql` (consistent, procedural, easy to add conditionals)
- All functions in `sql` (inline-able by the optimizer)
- Mixed by complexity (chosen)

**Rationale:** `LANGUAGE sql` functions are inline-able — the query planner can fold them into the calling query and optimize the whole as one plan. This is a meaningful benefit for `blast_radius()` and `coverage_gaps()`, which contain complex CTEs that benefit from the planner seeing the full query context. `plpgsql` is required for `sod_check()` because it uses local variables and conditional logic (`IF ... THEN`). The trigger function `tg_audit_log()` must be `plpgsql` because PostgreSQL trigger functions must return `trigger` type, which only `plpgsql` supports.

---

## D018 — CROSS JOIN LATERAL in permission_overlap()

**Decision:** `permission_overlap(p_resource_id)` uses `FROM governance.agents a CROSS JOIN LATERAL governance.effective_permissions(a.id) ep` to compute per-agent effective permissions.

**Alternatives considered:**
- Materialize all effective permissions into a temp table first, then filter by resource
- Subquery with correlated `effective_permissions(a.id)` call per agent
- `CROSS JOIN LATERAL` (chosen)

**Rationale:** `LATERAL` allows the subquery (function call) to reference columns from the outer `FROM` clause — it's the standard SQL pattern for applying a set-returning function to each row of a table. The alternative (correlated subquery) cannot be used with set-returning functions in PostgreSQL's `WHERE` clause. Materialization into a temp table would be appropriate for a scheduled batch job but not for an interactive query function where the caller expects fresh results. The function is explicitly documented as expensive and intended for targeted investigation on specific resources, not full-table scans.

---

## D019 — Tool ID Nullable in Permissions

**Decision:** `permissions.tool_id` is nullable. A null `tool_id` means the permission applies to the resource regardless of which tool is used to access it.

**Alternatives considered:**
- Require every permission to specify a tool (deny-all unless tool is explicitly named)
- A sentinel "any tool" tool record
- Nullable `tool_id` with semantic meaning (chosen)

**Rationale:** Not all resources are accessed exclusively through tools. A resource may be accessible via direct database connection (for a DBA role), via an MCP tool, or via an API — the governance administrator may want to grant access at the resource level without enumerating every tool. A sentinel record ("any-tool") would pollute the `tools` table and require every query to handle the sentinel as a special case. Nullable `tool_id` is idiomatic SQL and clearly documented. The `blast_radius()` function handles null tool_id correctly: a permission with null tool_id grants direct resource access, while a permission with a specific tool_id grants access to both the tool's explicitly listed resources and the directly specified resource.

---

## D020 — Sensitivity Classification Ordering

**Decision:** The `sensitivity_classification` enum is ordered `public < internal < confidential < restricted < critical` and stored as a PostgreSQL enum (where enum ordering follows declaration order).

**Alternatives considered:**
- Store as integer (1–5) with a lookup table
- Store as text with application-layer ordering
- Ordered enum (chosen)

**Rationale:** PostgreSQL enums support comparison operators (`<`, `>`, `BETWEEN`) when values are defined in order. This allows queries like `WHERE r.sensitivity >= 'restricted'` without a subquery or CASE expression. The ordering is declaration-order in the `CREATE TYPE` statement and is preserved through migrations. Adding new levels between existing ones requires `ALTER TYPE ... ADD VALUE ... BEFORE/AFTER` — documented as a considered trade-off; the current five-level taxonomy matches industry standard (similar to data classification frameworks used in SOC 2 and NIST 800-53).

---

## D021 — Schema Split: governance vs governance_private

**Decision:** All trigger functions and internal helpers live in `governance_private`. All tables, public functions, and views live in `governance`.

**Alternatives considered:**
- Everything in one `governance` schema
- Three schemas: `governance` (tables), `governance_api` (functions/views), `governance_private` (triggers)
- Two-schema split: `governance` + `governance_private` (chosen)

**Rationale:** The two-schema split is the established pgpm-modules convention (used in `@pgpm/defaults`, `@pgpm/faker`, and other reference modules). `GRANT USAGE ON SCHEMA governance TO authenticated` gives application roles access to the public surface without exposing internal implementation. Trigger functions use `SECURITY DEFINER` and should not be callable by application roles directly — placing them in `governance_private` (which has no USAGE grant to non-superuser roles) enforces this. A three-schema split adds coordination overhead without meaningful separation beyond the two-schema model.

---

## D022 — GIN Indexes on Array Columns

**Decision:** Add GIN indexes on `permissions.actions`, `resources.supported_actions`, and `sod_constraints.conflict_actions` (array columns queried with `@>` or `= ANY()`).

**Alternatives considered:**
- B-tree index on the array column (only works for equality on full array, not element membership)
- No index (acceptable for small tables; governance schemas tend to stay small)
- GIN index (chosen)

**Rationale:** The canonical query pattern for these columns is "find permissions that include the 'delete' action" — i.e., `WHERE 'delete' = ANY(actions)`. This requires a GIN index (`@>` or `= ANY()` with GIN). B-tree cannot accelerate element-membership queries on arrays. The tables are not expected to be large (hundreds to low thousands of rows for most deployments), but governance intelligence queries (`blast_radius`, `effective_permissions`) may scan all permissions for a given agent, making index acceleration meaningful at production scale.

---

## D023 — Seed Data Scope

**Decision:** Seed data ships four compliance frameworks (GDPR 2018, EU AI Act 2024, SOC 2 Type II 2017, Internal Policy template), five built-in roles, and four SoD constraint templates. SoD templates are seeded as `inactive` by default.

**Alternatives considered:**
- No seed data (deploy only the schema; operators populate reference data)
- Full seed data including sample agents, resources, and permissions (for demo purposes)
- Minimal reference seed (frameworks, roles, SoD templates only) with no sample data (chosen)

**Rationale:** Compliance frameworks and built-in roles are prerequisites for using the system — an operator cannot assign a "governance_admin" role before it exists, and cannot create rules that trace to GDPR without a GDPR framework record. Shipping these as seed data reduces setup friction. Sample agents and resources are NOT seeded — they would need to be cleaned up before production use, creating a footgun. SoD constraint templates are seeded inactive: they represent industry-standard patterns (initiator/approver, data accessor/data deleter) that operators can activate without needing to know the constraint structure, but inactive by default so they don't generate false violations on fresh installs.

---

## D024 — effective_permissions() Returns Both allow and deny

**Decision:** `effective_permissions()` returns all permissions reachable through the role hierarchy, including both `allow` and `deny` grant types. It does NOT compute the net effective access.

**Alternatives considered:**
- Return only allow grants (computed net access)
- Return allow grants minus deny grants (fully resolved effective access)
- Return all grants with grant_type column (chosen)

**Rationale:** Computing net effective access inside the database function would discard information Layer 2 may need — specifically, which role or which depth in the hierarchy created the deny. An audit or SoD check may need to know not just "this action is denied" but "it's denied because Role X at depth 2 has an explicit deny, which conflicts with the allow at depth 0." Returning raw grants with `grant_type` and `role_depth` preserves this lineage. Layer 2's responsibility is to compute the final effective permission set using the deny-overrides-allow rule (D002). This also means `sod_check()` correctly filters to allow-only grants before checking SoD constraints — an agent that has a deny on an action does not effectively hold that permission for SoD purposes.
