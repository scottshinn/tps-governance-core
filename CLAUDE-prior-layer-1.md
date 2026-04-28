# CLAUDE.md — TPS Governance Data Model (Layer 1)

## Project Identity

**Name:** `@tpsdev/governance-core`
**Full Name:** TPS — Tool Permission System
**Tagline:** "Trust. Permissions. Security. — Governance infrastructure for AI agents."
**Type:** pgpm module — a PostgreSQL package built with the pgpm workflow for modular Postgres development
**License:** MIT
**Author:** Scott Shinn
**GitHub Org:** tps-dev (or tps-reports-dev — confirm availability)
**npm Scope:** @tpsdev

## What This Is

TPS is the governance data layer for AI agents. It models the full permission, access, and compliance surface of AI agent deployments as a normalized PostgreSQL schema. It is designed to answer the question that no existing tool can: *"Across all of my agents, tools, and resources — who can do what, why are they allowed to, and where are the gaps?"*

TPS is a three-layer architecture:
- **Layer 1 — `@tpsdev/governance-core` (this module):** The Postgres schema — tables, relationships, RLS policies, indexes, seed data, and audit infrastructure
- **Layer 2 — `@tpsdev/governance-engine` (future):** A TypeScript query and analysis engine for overlap detection, segregation of duties validation, risk scoring, and governance intelligence. This is the npm package that depends on the pgpm module.
- **Layer 3 — TPS KYA (future):** The "Know Your Agent" visual control plane for operators — a terminal-like GUI showing all agents, their permissions, their topology, and the full I/O surface of a deployment

The name "TPS" is a backronym for Tool Permission System (or Trust, Permissions, Security). The cultural reference to TPS Reports is intentional — governance documentation that everyone needs but nobody wants to manage manually. TPS automates the TPS reports.

Layer 1 must be designed so that Layers 2 and 3 can be built on top without schema changes. The data model is the foundation — if it's wrong, everything above it breaks.

## Required Context

The reference research has been done and is captured in `docs/`. New sessions should read these before writing SQL or making architectural decisions:

- `docs/PGPM-CONVENTIONS.md` — patterns from pgpm-modules: deploy/verify/revert format, pgpm.plan syntax, verify helpers, test harness, CLI workflow
- `docs/SANNA-PROTOCOL-NOTES.md` — Sanna constitution format mapped to TPS equivalents; what TPS does and does not implement; future integration points
- `docs/ARCHITECTURE.md` — full entity relationship model, design principles, function design, RLS policy matrix
- `docs/DATA-MODEL-REFERENCE.md` — every table, column, function, view with descriptions
- `DECISIONS.md` — every design decision with alternatives considered and rationale (D001–D024)

**Sanna license note:** Sanna is AGPL-3.0. TPS does not copy or fork Sanna. TPS is the authoring and management layer; Sanna is the enforcement and receipt layer. They are complementary.

## Architecture Principles

### 1. Everything Is Auditable
Every table that stores mutable governance state MUST have a corresponding audit mechanism. When a role is created, a permission is granted, an agent is registered, or a rule is modified — the previous state, the new state, the actor, the timestamp, and the reason for change must be captured. This is not optional. Regulators and auditors need point-in-time reconstruction of "who could do what, when."

### 2. The Schema Is the Governance Model
The foreign keys, constraints, and relationships in the schema ARE the governance logic. If an agent can only access resources through tools, and tools are granted through permissions, and permissions flow through roles — then the schema enforces that path. There should be no way to create a "dangling" permission that isn't attached to a role, or a tool grant that bypasses the permission model.

### 3. Resources Are First-Class Citizens
Resources (databases, tables, API endpoints, webhooks, file stores, MCP servers, external services) must be modeled with enough metadata to enable meaningful governance queries. A resource has a type, a sensitivity classification, a data category, and directionality (read/write/execute). Without rich resource metadata, you can't answer "which agents have access to PII" or "what's our total exposure to financial data."

### 4. Agents Have Topology
Agents exist in hierarchies. An orchestrator delegates to sub-agents. Sub-agents may spawn further agents. The governance model must capture this tree structure: who reports to whom, who can delegate to whom, and what the span of control is at each level. An agent's effective permissions are the intersection of its own grants and its parent's delegation scope.

### 5. Rules Trace to Requirements
Every governance rule should be traceable to a compliance requirement, an internal policy, or a risk assessment. "This agent cannot access PII" is a rule. "GDPR Article 5(1)(f) requires appropriate security of personal data" is the requirement. The link between them must be explicit and queryable.

### 6. Design for Query, Not Just Storage
The schema must support the governance intelligence queries that Layer 2 will run:
- "Which agents have overlapping write access to the same resource?"
- "Are there segregation of duties violations — agents that can both initiate and approve the same action?"
- "Which resources have no governance rules attached?"
- "What is the blast radius if this agent is compromised — what can it transitively reach?"
- "Show me every permission grant that traces back to GDPR compliance."
- "Which agents have unrestricted access to any resource type?"

Indexes, views, and materialized views should be planned with these queries in mind.

## Data Model — Domain Entities

The following entities must be modeled. For each entity, think carefully about: what are its attributes, what are its relationships to other entities, what constraints enforce correctness, and what queries will need to be efficient.

### Core Entities

#### Agents
An AI agent that is governed by this system.
- Identity: unique ID, human-readable name, version/revision
- Purpose: declared mission/description of what this agent is supposed to do
- Lifecycle state: proposed → under_review → approved → active → suspended → decommissioned
- Agent type: orchestrator, worker, autonomous, human-in-the-loop
- Reporting chain: which agent or human this agent reports to (self-referential FK for agent hierarchies, nullable for top-level agents)
- Delegation scope: what this agent is allowed to delegate to sub-agents
- Product/service affiliation: which product or deployment this agent belongs to
- Metadata: creation date, last review date, review cycle interval, owner (human), contact

#### Resources
Anything an agent can interact with — the I/O surface.
- Identity: unique ID, human-readable name, description
- Resource type: database, table, column, api_endpoint, webhook, file_store, mcp_server, external_service, queue, secret_store, model_endpoint
- Sensitivity classification: public, internal, confidential, restricted, critical
- Data categories (many-to-many): PII, PHI, financial, intellectual_property, authentication_credential, system_configuration, audit_data, customer_data, employee_data
- Directionality: read, write, create, delete, execute, admin (a resource can support multiple)
- Location/endpoint: URI, connection string, or path that identifies this resource
- Owner: team or individual responsible for this resource
- Product/service affiliation: which system this resource belongs to

#### Tools
Specific capabilities exposed through MCP or other interfaces. Tools are the actual enforcement boundary — agents access resources THROUGH tools.
- Identity: unique ID, human-readable name, description
- MCP server: which MCP server exposes this tool (nullable for non-MCP tools)
- Tool type: mcp_tool, api_call, database_query, file_operation, webhook_trigger, custom
- Parameters: JSON schema of accepted parameters
- Resources accessed: which resources this tool reads from or writes to (many-to-many with directionality)
- Risk profile: what is the worst-case impact of unrestricted use of this tool
- Idempotency: is this tool safe to retry, or is it destructive/non-reversible

#### Roles
Named collections of permissions that can be assigned to agents.
- Identity: unique ID, human-readable name, description
- Role hierarchy: roles can inherit from parent roles (self-referential FK)
- Scope: global, product-level, agent-level
- Built-in flag: is this a system-defined role or a custom role
- Max assignment count: optional limit on how many agents can hold this role simultaneously

#### Permissions
The link between roles and what they're allowed to do. A permission grants a specific action on a specific resource (optionally through a specific tool).
- Role FK: which role this permission belongs to
- Resource FK: which resource this permission applies to
- Tool FK: optionally, which tool this permission is scoped to (null = any tool that accesses the resource)
- Actions: array of allowed actions (read, write, create, delete, execute, approve, delegate)
- Conditions: optional JSON conditions for ABAC-style rules (time windows, IP ranges, tenant scopes, request rate limits, requires_approval_above_threshold)
- Grant type: allow, deny (explicit deny overrides allow)
- Expiration: optional timestamp for time-bounded permissions

#### Agent-Role Assignments
The binding of agents to roles.
- Agent FK
- Role FK
- Assigned by: who granted this (human or system)
- Assigned at: timestamp
- Reason: why this assignment was made
- Expiration: optional
- Status: active, suspended, expired, revoked

### Governance Entities

#### Rules
Evaluable governance checks that assess the current state of the permission model.
- Identity: unique ID, human-readable name, description
- Rule type: access_control, segregation_of_duties, data_protection, risk_threshold, coverage_requirement, approval_requirement, delegation_constraint
- Condition: a structured representation of what this rule checks (JSON or DSL — design this carefully as it's the core of the evaluation engine)
- Action on violation: deny, flag_for_review, require_approval, alert, log_only
- Severity: critical, high, medium, low, informational
- Status: draft, active, disabled, deprecated
- Scope: global, product-level, agent-level, resource-level

#### Rule Sets
Composable collections of rules that can be applied at different scopes.
- Identity: unique ID, name, description
- Rules: many-to-many with rules
- Scope binding: what this rule set is applied to (global, a specific product, a specific agent class)
- Compliance framework FK: optional link to the compliance requirement this rule set satisfies

#### Compliance Frameworks
External requirements that mandate governance rules.
- Identity: unique ID, name, version, description
- Framework type: regulation (GDPR, EU AI Act), standard (SOC 2, ISO 27001), internal_policy, contractual_obligation
- Requirements: one-to-many child records, each a specific requirement within the framework
- Effective date, review date

#### Compliance Requirements
Specific requirements within a compliance framework.
- Identity: unique ID, reference code (e.g., "GDPR Art. 5(1)(f)"), description
- Framework FK
- Rules: many-to-many with rules (which rules satisfy this requirement)
- Status: met, partially_met, not_met, not_applicable

#### Segregation of Duties (SoD) Constraints
First-class declarations that certain permission combinations must not coexist.
- Identity: unique ID, name, description
- Constraint type: same_agent (no single agent may hold both), same_role (no single role may contain both), same_hierarchy (no agent chain may hold both)
- Permission set A: one side of the constraint (FKs to permissions or abstract permission patterns)
- Permission set B: the other side
- Severity: critical, high, medium, low
- Compliance requirement FK: why this constraint exists

### Operational Entities

#### Products / Deployments
Logical grouping of agents, resources, and rules by product or service.
- Identity: unique ID, name, description
- Owner: team or individual
- Agents: one-to-many
- Resources: one-to-many

#### MCP Servers
MCP server registrations that expose tools to agents.
- Identity: unique ID, name, description, endpoint URL
- Tools: one-to-many
- Status: active, inactive, deprecated
- Authentication method: none, api_key, oauth, mTLS

#### Audit Log
Immutable record of every governance-relevant action.
- Event ID (UUID), timestamp
- Actor: who or what performed the action (human user ID, system process, agent ID)
- Action type: agent_registered, role_created, permission_granted, permission_revoked, rule_created, rule_modified, assignment_created, assignment_revoked, sod_violation_detected, etc.
- Entity type and entity ID: what was affected
- Previous state: JSON snapshot of the entity before the change
- New state: JSON snapshot after
- Reason: free-text justification
- Correlation ID: for grouping related audit events

#### Risk Assessments
Computed risk scores for agents, roles, or permission sets.
- Entity type and entity ID: what is being assessed
- Risk score: numeric (define a consistent scale)
- Risk factors: JSON array of contributing factors
- Assessed at: timestamp
- Assessment method: manual, automated, hybrid

## pgpm Module Structure

Actual built layout (note: no `sql/` wrapper — deploy/verify/revert sit directly under the package root, per pgpm convention):

```
packages/
  governance-core/
    package.json                    # @tpsdev/governance-core
    pgpm.plan                       # 40-entry DAG (deploy order + dependencies)
    governance-core.control         # requires pgcrypto, uuid-ossp, citext, pg_trgm, btree_gist, plpgsql
    jest.config.js                  # maxWorkers: 1 (required for DB integration tests)
    tsconfig.json
    deploy/
      schemas/
        governance/
          schema.sql
          types/enums.sql           # 22 enum types
          tables/
            products/table.sql
            mcp_servers/table.sql
            agents/table.sql
            resources/table.sql
            tools/table.sql
            roles/table.sql
            permissions/table.sql
            agent_role_assignments/table.sql
            resource_data_categories/table.sql
            tool_resources/table.sql
            compliance_frameworks/table.sql
            compliance_requirements/table.sql
            rules/table.sql
            rule_sets/table.sql
            rule_set_rules/table.sql
            rule_compliance_reqs/table.sql
            sod_constraints/table.sql
            sod_constraint_permissions/table.sql
            audit_log/table.sql
            risk_assessments/table.sql
            agents/policies/enable_rls.sql
            agents/policies/access_policies.sql
            audit_log/policies/enable_rls.sql
            audit_log/policies/access_policies.sql
          functions/
            effective_permissions.sql
            sod_check.sql
            blast_radius.sql
            permission_overlap.sql
            coverage_gaps.sql
            attach_audit_triggers.sql
          views/
            agent_topology.sql
            agent_summary.sql
            resource_exposure.sql
            sod_violations.sql
            ungoverned_resources.sql
          indexes/performance_indexes.sql
        governance_private/
          schema.sql
          functions/audit_trigger.sql  # SECURITY DEFINER trigger function
    verify/                         # mirrors deploy/ — uses verify_* helper functions
    revert/                         # mirrors deploy/ — DROP/ALTER to undo each change
    seed/
      reference_data.sql            # 4 frameworks, 15 requirements, 5 roles, 4 SoD templates
    __tests__/
      basic.test.ts
      schema.test.ts
      agents.test.ts
      audit_trail.test.ts
      role_hierarchy.test.ts
      effective_permissions.test.ts
      sod_violations.test.ts
      blast_radius.test.ts
```

## SQL Conventions

- All tables live in the `governance` schema (not `public`)
- Use `uuid` primary keys generated by `gen_random_uuid()`
- Use `timestamptz` for all timestamps, defaulting to `now()`
- Use `text` for string fields unless there's a specific reason for `varchar(n)`
- Use PostgreSQL `enum` types for fixed taxonomies (agent lifecycle states, severity levels, resource types, etc.)
- Use `jsonb` for flexible/extensible metadata fields (conditions, parameters, risk factors)
- Name constraints explicitly (e.g., `fk_permissions_role`, `chk_agents_lifecycle_state`)
- Add `COMMENT ON TABLE` and `COMMENT ON COLUMN` for every table and non-obvious column
- Every mutable table gets the audit trigger attached
- Foreign keys should specify `ON DELETE` behavior explicitly (usually `RESTRICT` for governance data — you should not be able to silently delete a role that has active assignments)

## Seed / Reference Data

The module should ship with sensible default reference data:

- **Data categories:** PII, PHI, financial, intellectual_property, authentication_credential, system_configuration, audit_data, customer_data, employee_data
- **Compliance frameworks:** GDPR (with key articles as requirements), EU AI Act (key articles), SOC 2 (relevant trust service criteria), a template "Internal Policy" framework
- **Built-in roles:** system_admin, governance_admin, agent_operator, auditor, read_only_observer
- **Risk scale:** 1-5 (negligible, low, moderate, high, critical) with descriptions
- **SoD templates:** Common segregation of duties patterns (initiator/approver, data accessor/data deleter, config modifier/config deployer)

## Testing Requirements

Write tests using `pgsql-test` (the Constructive testing framework). Tests must cover:

1. **Schema integrity:** All tables, columns, constraints, and indexes exist after deploy
2. **Referential integrity:** Foreign keys prevent orphaned records; ON DELETE RESTRICT works
3. **Audit trail:** Every INSERT, UPDATE, DELETE on governed tables creates an audit_log entry
4. **Role hierarchy resolution:** The `effective_permissions` function correctly resolves permissions through multi-level role inheritance
5. **SoD detection:** The `sod_check` function correctly identifies violations when conflicting permissions are assigned
6. **Blast radius computation:** The `blast_radius` function correctly traces transitive access through tool → resource relationships
7. **Permission overlap detection:** The `permission_overlap` function correctly identifies agents with overlapping access
8. **Coverage gap detection:** The `coverage_gaps` function correctly identifies ungoverned resources
9. **RLS policies:** Row-level security correctly scopes access based on the governance model's own access controls
10. **Revert safety:** Every deploy can be cleanly reverted, and verify scripts fail after revert

## Design Decisions

All design decisions are documented in `DECISIONS.md` (D001–D024). Key ones:

- **D001** — Rule conditions stored as `jsonb` with `"type"` discriminant (not DSL, not stored PG expressions)
- **D002** — Deny-override model: explicit deny grants override allow at same resource+action
- **D003** — Role hierarchy depth capped at 20 in recursive CTEs
- **D004** — Temporal modeling via `expires_at` + append-only audit log (no event sourcing or temporal tables)
- **D005** — Single-tenant; multi-org isolation is deployment-level (separate databases)
- **D006** — SoD constraints use junction table with `side='a'|'b'` (not UUID arrays)
- **D007** — RLS controlled by `current_setting('tps.role')` session variable (not database roles)
- **D008** — Audit log is append-only; no UPDATE/DELETE policies; trigger is SECURITY DEFINER
- **D009** — `coverage_gaps()` flags resources missing EITHER permissions OR resource-scoped rules

See DECISIONS.md for D010–D024 covering type choices, schema split, GIN indexes, function language selection, and more.

## What NOT to Build (Yet)

- No TypeScript application code — that's Layer 2
- No Python application code — a Python SDK (`tpsdev` on PyPI) is planned as a parallel Layer 2 client
- No UI — that's Layer 3
- No YAML export — that's Layer 2
- No Sanna integration — that's Layer 2
- No API endpoints — that's Layer 2
- No real-time enforcement — Sanna or other tools handle that
- No LLM/AI evaluation of rules — rules are deterministic, not probabilistic

Focus exclusively on getting the Postgres schema, functions, views, triggers, tests, and seed data right. The data model is the product at this layer.

## Multi-Language Compatibility

TPS will have both TypeScript (npm) and Python (PyPI) clients consuming this schema. This has implications for Layer 1 design:

- **Keep business logic in Postgres, not in application code.** Functions like `effective_permissions()`, `sod_check()`, and `blast_radius()` live in the database so both TypeScript and Python clients get identical results without reimplementing logic.
- **Use standard SQL types.** Avoid PostgreSQL-specific type tricks that don't map cleanly to Python's psycopg3 or SQLAlchemy type system. `uuid`, `timestamptz`, `text`, `jsonb`, `boolean`, `integer`, and enum types are all fine.
- **Document the function signatures clearly.** Every SQL function should have `COMMENT ON FUNCTION` that describes inputs, outputs, and behavior — these comments become the contract that both SDK authors implement against.
- **Return structured results from functions.** Prefer `RETURNS TABLE(...)` or `RETURNS SETOF` over scalar returns where possible — this maps cleanly to both TypeScript row types and Python dataclasses/Pydantic models.

## Iteration and Refinement

This prompt is designed to be refined as the project evolves. When we learn something new about the domain, discover a missing entity, or need to restructure a relationship — we update this document and add a new migration. The pgpm deploy/verify/revert pattern supports iterative evolution.

Mark any assumptions you make with `-- ASSUMPTION:` comments in the SQL so we can revisit them.

When in doubt about a design decision, prefer:
- Normalization over denormalization (we can add materialized views later for performance)
- Explicit over implicit (name everything, constrain everything, document everything)
- Restrictive over permissive (it's easier to relax constraints than to add them after data exists)

## Build Status

### Done
- [x] All 42 deploy SQL files written (`schemas/`, `tables/`, `functions/`, `views/`, `policies/`, `indexes/`)
- [x] All 42 verify scripts written (mirror deploy structure; use `verify_*` helpers)
- [x] All 40 revert scripts written (cleanly undo each deploy)
- [x] `pgpm.plan` — full 40-entry DAG with correct dependency ordering
- [x] `governance_private.tg_audit_log()` SECURITY DEFINER trigger function
- [x] `attach_audit_triggers()` — attaches trigger to all 17 mutable tables
- [x] Six governance intelligence functions: `effective_permissions`, `sod_check`, `blast_radius`, `permission_overlap`, `coverage_gaps`, `agent_tool_inventory`
- [x] Six views: `agent_topology`, `agent_summary`, `agent_tool_summary`, `resource_exposure`, `sod_violations`, `ungoverned_resources`
- [x] RLS on `agents` and `audit_log` — four policies each, controlled by `tps.role` session variable
- [x] Performance indexes including partial indexes for hot-path governance queries
- [x] Seed data: 4 compliance frameworks, 15 requirements, 5 built-in roles, 4 SoD constraint templates
- [x] 12 test files covering audit trail, role hierarchy, SoD violations, blast radius, effective permissions, agents, schema integrity, permission_overlap, coverage_gaps, rls_policies, permissions
- [x] `governance.agent_tool_inventory(agent_id)` function — tool-centric governance intelligence for KYA Layer 3
- [x] `governance.agent_tool_summary` view — dashboard companion showing tool counts per active/approved agent
- [x] `docs/ARCHITECTURE.md`, `docs/PGPM-CONVENTIONS.md`, `docs/SANNA-PROTOCOL-NOTES.md`, `docs/DATA-MODEL-REFERENCE.md`
- [x] `DECISIONS.md` — 25 decisions covering every significant design choice

### Pending (not yet run against a live database)
- [ ] `pgpm deploy --createdb --database governance_dev` — deploy validation
- [ ] `pgpm verify --database governance_dev` — all 42 verify scripts pass
- [ ] `pnpm test` — all test suites pass against deployed schema
- [ ] `pgpm revert --database governance_dev` — full revert succeeds cleanly

### Previously missing tests (now written)
- [x] `__tests__/permission_overlap.test.ts` — `permission_overlap()` function
- [x] `__tests__/coverage_gaps.test.ts` — `coverage_gaps()` / `ungoverned_resources` view
- [x] `__tests__/rls_policies.test.ts` — RLS policy configuration and session variable behavior (enforcement requires non-superuser `db` connection or `FORCE ROW LEVEL SECURITY`)
- [x] `__tests__/permissions.test.ts` — permission grant/deny mechanics, expiration, schema constraints
