# TPS governance-core — Data Model Reference

Quick reference for every table, view, function, and type in the `governance` schema. All objects live in `packages/governance-core/deploy/schemas/governance/` unless noted.

---

## Schemas

| Schema | Purpose |
|---|---|
| `governance` | Public API: tables, views, governance intelligence functions |
| `governance_private` | Internal: trigger function, private helpers |

---

## Enum Types (`governance` schema)

| Type | Values | Used In |
|---|---|---|
| `agent_lifecycle_state` | `proposed, under_review, approved, active, suspended, decommissioned` | `agents.lifecycle_state` |
| `agent_type` | `orchestrator, worker, autonomous, human_in_the_loop` | `agents.agent_type` |
| `resource_type` | `database, table, column, api_endpoint, webhook, file_store, mcp_server, external_service, queue, secret_store, model_endpoint` | `resources.resource_type` |
| `sensitivity_classification` | `public, internal, confidential, restricted, critical` | `resources.sensitivity` |
| `data_category` | `pii, phi, financial, intellectual_property, authentication_credential, system_configuration, audit_data, customer_data, employee_data` | `resource_data_categories.data_category` |
| `action_type` | `read, write, create, delete, execute, admin, approve, delegate` | `permissions.actions[]`, `tool_resources.actions[]`, `resources.supported_actions[]` |
| `tool_type` | `mcp_tool, api_call, database_query, file_operation, webhook_trigger, custom` | `tools.tool_type` |
| `grant_type` | `allow, deny` | `permissions.grant_type` |
| `assignment_status` | `active, suspended, expired, revoked` | `agent_role_assignments.status` |
| `rule_type` | `access_control, segregation_of_duties, data_protection, risk_threshold, coverage_requirement, approval_requirement, delegation_constraint` | `rules.rule_type` |
| `violation_action` | `deny, flag_for_review, require_approval, alert, log_only` | `rules.violation_action` |
| `severity` | `critical, high, medium, low, informational` | `rules.severity`, `sod_constraints.severity` |
| `rule_status` | `draft, active, disabled, deprecated` | `rules.status` |
| `scope_level` | `global, product, agent, resource` | `rules.scope`, `rule_sets.scope`, `roles.scope` |
| `framework_type` | `regulation, standard, internal_policy, contractual_obligation` | `compliance_frameworks.framework_type` |
| `requirement_status` | `met, partially_met, not_met, not_applicable` | `compliance_requirements.status` |
| `sod_constraint_type` | `same_agent, same_role, same_hierarchy` | `sod_constraints.constraint_type` |
| `mcp_auth_method` | `none, api_key, oauth, mtls` | `mcp_servers.auth_method` |
| `mcp_server_status` | `active, inactive, deprecated` | `mcp_servers.status` |
| `audit_action_type` | 30 event type values (see enums.sql) | `audit_log.action_type` |
| `assessment_method` | `manual, automated, hybrid` | `risk_assessments.assessment_method` |
| `risk_level` | `negligible, low, moderate, high, critical` | `risk_assessments.risk_level` |

---

## Tables

### `governance.products`

Logical grouping of agents, resources, and rules by product or service deployment.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier |
| `name` | text UNIQUE | Human-readable product name |
| `description` | text | Optional description |
| `owner` | text NOT NULL | Team or individual responsible |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification timestamp |

---

### `governance.mcp_servers`

Registered MCP (Model Context Protocol) server instances that expose tools to agents.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier |
| `name` | text UNIQUE | Human-readable server name |
| `description` | text | Optional description |
| `endpoint_url` | text NOT NULL | Network endpoint (URL or socket path) |
| `status` | mcp_server_status | `active`, `inactive`, or `deprecated` |
| `auth_method` | mcp_auth_method | How to authenticate to this server |
| `metadata` | jsonb | Version, transport type, capability flags |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification timestamp |

---

### `governance.agents`

AI agents registered for governance oversight. Central entity.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier |
| `name` | text | Human-readable name |
| `version` | text | Optional version string |
| `description` | text | Optional description |
| `purpose` | text NOT NULL | Declared mission — what this agent is designed to do |
| `lifecycle_state` | agent_lifecycle_state | State machine; defaults to `proposed` |
| `agent_type` | agent_type NOT NULL | Orchestrator, worker, autonomous, or HITL |
| `parent_agent_id` | uuid FK→agents | Orchestrator agent this agent reports to (nullable) |
| `product_id` | uuid FK→products | Product this agent belongs to (nullable) |
| `delegation_scope` | jsonb | Permission subset this agent may delegate to sub-agents |
| `owner` | text NOT NULL | Human or team responsible for this agent |
| `contact` | text | Contact email or handle |
| `last_review_at` | timestamptz | When permissions were last reviewed |
| `review_cycle_days` | integer | How often (days) to re-review (nullable = no scheduled review) |
| `metadata` | jsonb | Extensible key-value metadata |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification timestamp |

**Unique constraint:** `(name, version)`
**Indexes:** `lifecycle_state`, `parent_agent_id`, `product_id`

---

### `governance.resources`

Anything an agent can interact with — the I/O surface of a deployment.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier |
| `name` | text | Human-readable name |
| `description` | text | Optional description |
| `resource_type` | resource_type NOT NULL | Structural category |
| `sensitivity` | sensitivity_classification | Data sensitivity level; defaults to `internal` |
| `supported_actions` | action_type[] NOT NULL | Which action types are valid for this resource |
| `location` | text | URI, connection string, or path |
| `owner` | text | Team or individual responsible |
| `product_id` | uuid FK→products | Product this resource belongs to (nullable) |
| `metadata` | jsonb | Extensible metadata |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification timestamp |

**Unique constraint:** `(name, resource_type)`
**Check:** `supported_actions` must be non-empty
**Indexes:** `resource_type`, `sensitivity`, `product_id`, GIN on `supported_actions`

---

### `governance.tools`

Specific capabilities exposed through MCP or other interfaces. The enforcement boundary.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier |
| `name` | text | Human-readable name |
| `description` | text | Optional description |
| `tool_type` | tool_type NOT NULL | Implementation category |
| `mcp_server_id` | uuid FK→mcp_servers | Required when `tool_type = 'mcp_tool'` |
| `parameters` | jsonb | JSON Schema of accepted input parameters |
| `risk_profile` | text | Worst-case narrative if used without controls |
| `is_idempotent` | boolean | Safe to retry without governance concern |
| `is_destructive` | boolean | Cannot be undone (deletion, purge, etc.) |
| `metadata` | jsonb | Extensible metadata |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification timestamp |

**Unique constraint:** `(name, mcp_server_id)`
**Check:** MCP tools must have `mcp_server_id`; non-MCP tools must not
**Indexes:** `mcp_server_id`, `tool_type`, partial on `is_destructive = true`

---

### `governance.roles`

Named collections of permissions. Roles form an inheritance hierarchy.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier |
| `name` | text UNIQUE | Human-readable name |
| `description` | text | Optional description |
| `parent_role_id` | uuid FK→roles | Parent role whose permissions are inherited (nullable) |
| `scope` | scope_level | `global`, `product`, or `agent`; defaults to `global` |
| `is_built_in` | boolean | True for system-defined roles that cannot be deleted |
| `max_assignments` | integer | Optional cap on concurrent active assignments |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification timestamp |

**Indexes:** `parent_role_id`, `scope`

---

### `governance.permissions`

The link between roles and what they are allowed to do.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier |
| `role_id` | uuid FK→roles NOT NULL | Role this permission belongs to |
| `resource_id` | uuid FK→resources NOT NULL | Resource this permission governs |
| `tool_id` | uuid FK→tools | Optional: only applies when accessed via this specific tool |
| `actions` | action_type[] NOT NULL | Array of permitted action types |
| `conditions` | jsonb | ABAC conditions (time windows, IP ranges, approval thresholds) |
| `grant_type` | grant_type | `allow` or `deny`; defaults to `allow` |
| `expires_at` | timestamptz | Optional expiration; after this the permission is inactive |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification timestamp |

**Unique constraint:** `(role_id, resource_id, tool_id, grant_type)`
**Check:** `actions` must be non-empty
**Indexes:** `role_id`, `resource_id`, `tool_id`, `grant_type`, `expires_at` (partial), GIN on `actions`
**Partial indexes:** `allow` grants, `deny` grants (separate for query optimizer)

---

### `governance.agent_role_assignments`

Binds agents to roles. Every permission flows through this table.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier |
| `agent_id` | uuid FK→agents NOT NULL | Agent being assigned |
| `role_id` | uuid FK→roles NOT NULL | Role being assigned |
| `assigned_by` | text NOT NULL | Identity of who granted this assignment |
| `reason` | text | Justification for why this assignment was made |
| `status` | assignment_status | `active`, `suspended`, `expired`, or `revoked`; defaults to `active` |
| `expires_at` | timestamptz | Optional expiration |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification timestamp |

**Unique constraint:** `(agent_id, role_id)` — one assignment record per agent+role pair
**Indexes:** `agent_id`, `role_id`, `status`, `expires_at` (partial)
**Active live partial index:** `(agent_id, role_id) WHERE status = 'active' AND expires_at IS NULL`

---

### `governance.resource_data_categories`

Junction: data categories present in a resource.

| Column | Type | Description |
|---|---|---|
| `resource_id` | uuid FK→resources PK | Resource |
| `data_category` | data_category PK | Data category enum value |

**Index:** `data_category` (for "find all PII resources" queries)

---

### `governance.tool_resources`

Junction: which resources a tool touches and with what actions.

| Column | Type | Description |
|---|---|---|
| `tool_id` | uuid FK→tools PK | Tool |
| `resource_id` | uuid FK→resources PK | Resource the tool accesses |
| `actions` | action_type[] NOT NULL | Action types this tool performs on this resource |

**Check:** `actions` must be non-empty
**Indexes:** `resource_id`, GIN on `actions`

---

### `governance.compliance_frameworks`

External regulations, standards, and internal policies.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier |
| `name` | text | Framework name (e.g., "GDPR") |
| `version` | text | Version or year (e.g., "2018") |
| `description` | text | Brief description |
| `framework_type` | framework_type | `regulation`, `standard`, `internal_policy`, `contractual_obligation` |
| `effective_date` | date | When the framework took effect |
| `review_date` | date | When our implementation should be reviewed |
| `source_url` | text | Authoritative source URL |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification timestamp |

**Unique constraint:** `(name, version)`

---

### `governance.compliance_requirements`

Specific articles or controls within a compliance framework.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier |
| `framework_id` | uuid FK→compliance_frameworks NOT NULL | Parent framework |
| `reference_code` | text NOT NULL | Standard article reference (e.g., "GDPR Art. 5(1)(f)") |
| `description` | text NOT NULL | Full description of the requirement |
| `status` | requirement_status | Satisfaction status; defaults to `not_met` |
| `notes` | text | Implementation notes |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification timestamp |

**Unique constraint:** `(framework_id, reference_code)`
**Indexes:** `framework_id`, `status`

---

### `governance.rules`

Evaluable governance checks — the core policy model.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier |
| `name` | text UNIQUE | Human-readable name |
| `description` | text | Optional description |
| `rule_type` | rule_type NOT NULL | Category of governance check |
| `condition` | jsonb NOT NULL | JSON condition with `"type"` discriminant — evaluated by Layer 2 |
| `violation_action` | violation_action | What to do when the rule fires; defaults to `flag_for_review` |
| `severity` | severity | Impact severity; defaults to `medium` |
| `status` | rule_status | Lifecycle state; defaults to `draft` |
| `scope` | scope_level | Granularity of application; defaults to `global` |
| `scope_entity_id` | uuid | ID of the scoped entity (product/agent/resource) when scope ≠ global |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification timestamp |

**Check:** `scope_entity_id` must be null when `scope = 'global'`, non-null otherwise
**Indexes:** `rule_type`, `status`, `severity`, `scope`, `scope_entity_id` (partial)
**Active partial index:** `(scope, scope_entity_id) WHERE status = 'active'`

---

### `governance.rule_sets`

Composable collections of rules applied at a specific scope.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier |
| `name` | text UNIQUE | Human-readable name |
| `description` | text | Optional description |
| `scope` | scope_level | Scope of application; defaults to `global` |
| `scope_entity_id` | uuid | ID of the scoped entity when scope ≠ global |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification timestamp |

---

### `governance.rule_set_rules`

Junction: which rules belong to which rule sets.

| Column | Type | Description |
|---|---|---|
| `rule_set_id` | uuid FK→rule_sets PK | Rule set |
| `rule_id` | uuid FK→rules PK | Rule |

**Index:** `rule_id`

---

### `governance.rule_compliance_reqs`

Junction: which compliance requirements a rule satisfies.

| Column | Type | Description |
|---|---|---|
| `rule_id` | uuid FK→rules PK | Rule |
| `requirement_id` | uuid FK→compliance_requirements PK | Requirement satisfied |

**Index:** `requirement_id`

---

### `governance.sod_constraints`

First-class declarations that certain permission combinations must not coexist.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier |
| `name` | text UNIQUE | Human-readable name |
| `description` | text | Explanation of the conflict |
| `constraint_type` | sod_constraint_type | `same_agent`, `same_role`, or `same_hierarchy` |
| `severity` | severity | Impact severity; defaults to `high` |
| `is_active` | boolean | Whether this constraint is currently enforced |
| `compliance_req_id` | uuid FK→compliance_requirements | Traceability to the requirement mandating this SoD |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification timestamp |

**Indexes:** `is_active` (partial), `severity`

---

### `governance.sod_constraint_permissions`

Junction: maps permissions to the two sides of a SoD constraint.

| Column | Type | Description |
|---|---|---|
| `constraint_id` | uuid FK→sod_constraints PK | SoD constraint |
| `permission_id` | uuid FK→permissions PK | Permission in this constraint |
| `side` | text CHECK ('a','b') PK | Which conflict side this permission belongs to |

**Indexes:** `permission_id`, `(constraint_id, side)`

---

### `governance.audit_log`

Immutable append-only record of every governance state change.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique event identifier |
| `occurred_at` | timestamptz NOT NULL | When the event happened |
| `actor` | text | Who performed the action (from `tps.current_actor` session variable) |
| `action_type` | audit_action_type NOT NULL | Enumerated event type |
| `entity_type` | text NOT NULL | Schema-qualified table name (e.g., `governance.agents`) |
| `entity_id` | uuid NOT NULL | UUID of the affected row |
| `previous_state` | jsonb | JSON snapshot before the change (null on INSERT) |
| `new_state` | jsonb | JSON snapshot after the change (null on DELETE) |
| `reason` | text | Free-text justification for the change |
| `correlation_id` | uuid | Groups related events from a single logical operation |
| `metadata` | jsonb | Additional context |

**No UPDATE or DELETE policies** — append-only by design
**Indexes:** `(entity_type, entity_id)`, `action_type`, `actor` (partial), `occurred_at DESC`, `correlation_id` (partial)
**Compound index:** `(entity_type, entity_id, occurred_at DESC)` for point-in-time reconstruction

---

### `governance.risk_assessments`

Point-in-time risk scores for agents, roles, or permission sets.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier |
| `entity_type` | text NOT NULL | Type of assessed entity (e.g., `governance.agents`) |
| `entity_id` | uuid NOT NULL | UUID of the assessed entity (polymorphic, no FK) |
| `risk_level` | risk_level NOT NULL | Qualitative risk label |
| `risk_score` | integer CHECK (1-5) | Numeric score: 1=negligible, 2=low, 3=moderate, 4=high, 5=critical |
| `risk_factors` | jsonb NOT NULL | Array of contributing factors: `[{factor, weight, description}]` |
| `assessment_method` | assessment_method NOT NULL | How produced: `manual`, `automated`, or `hybrid` |
| `assessor` | text | Who or what produced the assessment |
| `notes` | text | Additional context |
| `assessed_at` | timestamptz NOT NULL | When the assessment was conducted |
| `valid_until` | timestamptz | When this assessment expires |
| `created_at` | timestamptz | Insertion timestamp |

**Indexes:** `(entity_type, entity_id)`, `risk_score DESC`, `assessed_at DESC`

---

## Functions

### `governance.effective_permissions(p_agent_id uuid)`

**Returns:** `TABLE (permission_id, role_id, role_name, role_depth, resource_id, tool_id, actions, conditions, grant_type, expires_at)`

Resolves the full permission set for an agent by walking the role hierarchy up to 20 levels deep. Returns both `allow` and `deny` grants — callers must check `grant_type`. Only considers active, non-expired role assignments. `role_depth = 0` = direct assignment; `N` = Nth-level inherited.

---

### `governance.sod_check(p_agent_id uuid)`

**Returns:** `TABLE (constraint_id, constraint_name, constraint_type, severity, side_a_perm_ids, side_b_perm_ids)`

Checks an agent for SoD violations. Returns one row per violated active SoD constraint, with the permission IDs from each conflicting side. Only considers active allow permissions; violations require holding at least one permission from each side of the constraint.

---

### `governance.blast_radius(p_agent_id uuid)`

**Returns:** `TABLE (resource_id, resource_name, resource_type, sensitivity, effective_actions, access_paths)`

Computes the full resource exposure for an agent: direct permissions plus resources reachable via tools. Results are deduplicated, with effective actions unioned and access paths listed. Ordered by sensitivity descending (most dangerous first).

---

### `governance.permission_overlap(p_resource_id uuid)`

**Returns:** `TABLE (agent_id, agent_name, agent_type, lifecycle_state, effective_actions, permission_count)`

Returns all active/approved agents with effective allow permissions on the specified resource. Uses `CROSS JOIN LATERAL` over all agents — intended for targeted queries, not full scans.

---

### `governance.coverage_gaps()`

**Returns:** `TABLE (resource_id, resource_name, resource_type, sensitivity, has_permission, has_rule)`

Returns resources missing either active permissions or active resource-scoped rules. Ordered by sensitivity descending.

---

### `governance.agent_tool_inventory(p_agent_id uuid)`

**Returns:** `TABLE (tool_id, tool_name, tool_type, mcp_server_id, mcp_server_name, is_destructive, is_idempotent, resource_count, effective_actions, granted_via_role_name, granted_via_role_depth)`

Returns all tools an agent can use, resolved through the role hierarchy. Only allow grants are included — tools blocked exclusively by deny grants are not shown. For each tool: identity and type metadata, destructive/idempotent flags, the count of resources reachable through it, the union of all effective actions granted across permissions referencing the tool, and the name and depth of the most direct granting role (depth 0 = direct assignment). Ordered by tool name. Primary data source for the KYA control plane hover-over-agent display.

---

### `governance_private.tg_audit_log()`

**Returns:** `TRIGGER`

Generic audit trigger function. Attach to any governance table with:
```sql
CREATE TRIGGER tg_audit_<table>
  AFTER INSERT OR UPDATE OR DELETE ON governance.<table>
  FOR EACH ROW EXECUTE FUNCTION governance_private.tg_audit_log(
    'insert_action_type',  -- TG_ARGV[0]: audit_action_type for INSERT, or NULL to skip
    'update_action_type',  -- TG_ARGV[1]: audit_action_type for UPDATE, or NULL to skip
    'delete_action_type'   -- TG_ARGV[2]: audit_action_type for DELETE, or NULL to skip
  );
```

Reads `current_setting('tps.current_actor', true)` for the actor. Uses `SECURITY DEFINER` to bypass RLS when writing to `audit_log`.

---

## Views

### `governance.agent_topology`

Recursive hierarchy view. Columns: `id, name, parent_agent_id, agent_type, lifecycle_state, product_id, depth, ancestor_ids (uuid[]), display_path (text)`. Max depth 20. Includes a cycle guard.

### `governance.agent_summary`

Agent with computed metrics: `active_role_count`, `latest_risk_score`, `latest_risk_level`, `review_overdue` (boolean). Intended for dashboards.

### `governance.agent_tool_summary`

Shows all approved/active agents with tool inventory metrics: `agent_id, agent_name, agent_type, lifecycle_state, total_tools, destructive_tools, mcp_servers_used, tool_names (text[])`. Uses `LATERAL` join over `agent_tool_inventory()`. Dashboard companion for the KYA agent list view.

### `governance.resource_exposure`

Resource with: `data_categories[]`, `active_agent_count`, `has_delete_grant`, `has_admin_grant`. Shows the blast surface of each resource.

### `governance.sod_violations`

All current SoD violations across active/approved agents. Columns: `agent_id, agent_name, lifecycle_state, constraint_id, constraint_name, constraint_type, severity, side_a_perm_ids, side_b_perm_ids`.

### `governance.ungoverned_resources`

Thin wrapper over `coverage_gaps()`. Same columns.

---

## Seed Data

File: `seed/reference_data.sql`

### Compliance Frameworks (4)
- GDPR (2018)
- EU AI Act (2024)
- SOC 2 Type II (2017)
- Internal Policy Template (v1.0)

### Compliance Requirements
- GDPR: Art. 5(1)(b), 5(1)(c), 5(1)(f), 25, 30
- EU AI Act: Art. 9, 10, 12, 14, 17
- SOC 2: CC6.1, CC6.2, CC6.3, CC7.2, CC9.2

### Built-in Roles (5)
- `system_admin` — unrestricted administrative access
- `governance_admin` — manage all governance entities
- `agent_operator` — manage agents and assignments
- `auditor` — read-only including audit log
- `read_only_observer` — read-only active entities only

### SoD Constraint Templates (4, inactive by default)
- Initiate-Approve Separation (critical)
- Data Access — Data Deletion Separation (high)
- Config Read — Config Write Separation (high)
- Credential Access — System Admin Separation (critical)

---

## Performance Index Summary

| Index | Table | Purpose |
|---|---|---|
| `idx_agent_role_assignments_active_live` | `agent_role_assignments` | Hot path for `effective_permissions()` |
| `idx_permissions_allow` | `permissions` | Fast allow grant lookup |
| `idx_permissions_deny` | `permissions` | Fast deny override check |
| `idx_permissions_resource_grant` | `permissions` | `permission_overlap()` |
| `idx_tool_resources_tool_id` | `tool_resources` | `blast_radius()` tool→resource traversal |
| `idx_resource_data_categories_pii` | `resource_data_categories` | "Find all PII resources" queries |
| `idx_audit_log_entity_time` | `audit_log` | Point-in-time reconstruction |
| `idx_rules_active` | `rules` | Coverage gap and rule evaluation queries |
| `idx_sod_constraint_perms_lookup` | `sod_constraint_permissions` | `sod_check()` |
