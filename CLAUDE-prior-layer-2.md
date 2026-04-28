# CLAUDE.md — TPS Governance Engine (Layer 2)

## Project Identity

**Name:** `@tpsdev/governance-engine`
**Full Name:** TPS Governance Engine
**Type:** TypeScript npm package — the query, analysis, and intelligence layer for the TPS governance schema
**License:** MIT
**Author:** Scott Shinn
**npm Scope:** @tpsdev
**Peer Dependency:** `@tpsdev/governance-core` (the pgpm module must be deployed to the target database)

## What This Is

`@tpsdev/governance-engine` is a TypeScript library that sits on top of the `@tpsdev/governance-core` PostgreSQL schema and provides:

1. **A typed client** for all governance operations (CRUD on agents, roles, permissions, resources, tools, rules, etc.)
2. **Net effective access computation** — resolving deny-overrides-allow from raw permission grants (the database returns both; this library computes the final answer)
3. **A rule evaluation engine** — interpreting the JSON rule conditions stored in `governance.rules` and evaluating them against the current governance state
4. **Governance intelligence queries** — overlap detection, SoD violation reporting, blast radius analysis, coverage gap identification, risk scoring
5. **Point-in-time reconstruction** — replaying the audit log to answer "what could Agent X do last Tuesday?"
6. **Sanna-compatible YAML export** — converting the TPS permission model into Sanna Protocol v1.4 constitution YAML documents
7. **A transaction context manager** — ensuring `tps.current_actor` and `tps.role` session variables are set correctly for every operation

This is NOT an API server, NOT a UI, and NOT an enforcement engine. It's a library that Layer 3 (TPS KYA) and any custom integration will import and call. It can also be used directly in scripts, CI pipelines, or REPL sessions.

## Required Context — Read These First

Before writing any code, read the Layer 1 documentation in the `governance-core` project:

1. **`docs/ARCHITECTURE.md`** — the full entity relationship model, design principles, function signatures, RLS policy matrix, session variable conventions
2. **`docs/DATA-MODEL-REFERENCE.md`** — every table, column, function, view, enum type, and index
3. **`DECISIONS.md`** — all 25 design decisions (D001–D025), especially:
   - **D001** — Rule conditions are `jsonb` with `"type"` discriminant; this library implements the evaluators
   - **D002** — Deny-overrides-allow; this library computes net effective access
   - **D004** — Point-in-time reconstruction requires replaying the audit log; this library implements it
   - **D007** — `tps.role` session variable controls RLS; this library sets it per-transaction
   - **D016** — `tps.current_actor` session variable for audit attribution; this library sets it
   - **D019** — `tool_id` nullable in permissions; null means "any tool"
   - **D024** — `effective_permissions()` returns both allow and deny; this library resolves the net
   - **D025** — `agent_tool_inventory()` is tool-centric; use it for tool queries, not `blast_radius()`
4. **`docs/SANNA-PROTOCOL-NOTES.md`** — the Sanna constitution format mapped to TPS equivalents; the YAML export feature implements this mapping
5. **`docs/PGPM-CONVENTIONS.md`** — for understanding the schema deployment model (not directly used by this package, but context for how the schema is structured)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Consumer Applications                  │
│         (Layer 3 KYA, scripts, CI, custom apps)         │
└──────────────────────────┬──────────────────────────────┘
                           │ imports
┌──────────────────────────▼──────────────────────────────┐
│              @tpsdev/governance-engine                    │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  TPS Client  │  │ Rule Engine  │  │ Sanna Exporter │  │
│  │             │  │              │  │                │  │
│  │ - CRUD ops  │  │ - Condition  │  │ - Constitution │  │
│  │ - Net perms │  │   evaluators │  │   YAML gen     │  │
│  │ - Queries   │  │ - Rule sets  │  │ - Policy hash  │  │
│  │ - Audit     │  │ - Compliance │  │ - Mapping      │  │
│  │   replay    │  │   checking   │  │                │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                │                   │           │
│  ┌──────▼────────────────▼───────────────────▼────────┐  │
│  │              Connection Manager                     │  │
│  │  - Pool management (pg or postgres.js)             │  │
│  │  - Transaction context (actor, role)               │  │
│  │  - Session variable lifecycle                      │  │
│  └──────────────────────┬─────────────────────────────┘  │
└─────────────────────────┼────────────────────────────────┘
                          │ SQL
┌─────────────────────────▼────────────────────────────────┐
│              PostgreSQL + @tpsdev/governance-core         │
│                                                          │
│  governance.effective_permissions()                       │
│  governance.sod_check()                                  │
│  governance.blast_radius()                               │
│  governance.permission_overlap()                         │
│  governance.coverage_gaps()                              │
│  governance.agent_tool_inventory()                       │
│  governance_private.tg_audit_log()                       │
│  + 17 tables, 5 views, RLS policies                     │
└──────────────────────────────────────────────────────────┘
```

## Package Structure

```
packages/governance-engine/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
│
├── src/
│   ├── index.ts                      # Public API barrel export
│   │
│   ├── client/
│   │   ├── tps-client.ts             # Main client class — the primary entry point
│   │   ├── connection.ts             # Connection pool + transaction context manager
│   │   └── types.ts                  # Shared TypeScript types mirroring the schema
│   │
│   ├── crud/
│   │   ├── agents.ts                 # Agent CRUD operations
│   │   ├── resources.ts              # Resource CRUD operations
│   │   ├── tools.ts                  # Tool CRUD operations
│   │   ├── roles.ts                  # Role CRUD operations
│   │   ├── permissions.ts            # Permission CRUD operations
│   │   ├── assignments.ts            # Agent-role assignment operations
│   │   ├── rules.ts                  # Rule CRUD operations
│   │   ├── rule-sets.ts              # Rule set CRUD operations
│   │   ├── compliance.ts             # Compliance framework + requirement operations
│   │   ├── sod-constraints.ts        # SoD constraint operations
│   │   ├── mcp-servers.ts            # MCP server operations
│   │   ├── products.ts               # Product CRUD operations
│   │   └── risk-assessments.ts       # Risk assessment operations
│   │
│   ├── intelligence/
│   │   ├── effective-permissions.ts  # Net effective access (deny-overrides-allow resolution)
│   │   ├── sod-analysis.ts           # SoD violation detection + reporting
│   │   ├── blast-radius.ts           # Transitive resource exposure analysis
│   │   ├── permission-overlap.ts     # Multi-agent access overlap detection
│   │   ├── coverage-gaps.ts          # Ungoverned resource detection
│   │   ├── tool-inventory.ts         # Agent tool inventory queries
│   │   ├── risk-scoring.ts           # Automated risk score computation
│   │   └── audit-replay.ts          # Point-in-time state reconstruction
│   │
│   ├── rules/
│   │   ├── rule-evaluator.ts         # Strategy pattern dispatcher for rule conditions
│   │   ├── evaluators/
│   │   │   ├── no-access-to-resource-type.ts
│   │   │   ├── max-sensitive-resource-count.ts
│   │   │   ├── requires-approval-for-action.ts
│   │   │   ├── no-pii-output-leakage.ts
│   │   │   ├── max-role-depth.ts
│   │   │   ├── no-unrestricted-access.ts
│   │   │   ├── require-review-cycle.ts
│   │   │   ├── delegation-scope-enforcement.ts
│   │   │   └── index.ts              # Registry of all evaluators
│   │   └── types.ts                  # Rule condition type definitions
│   │
│   ├── export/
│   │   ├── sanna-exporter.ts         # TPS → Sanna YAML constitution export
│   │   ├── sanna-types.ts            # Sanna constitution TypeScript types
│   │   └── yaml-serializer.ts        # YAML generation with proper formatting
│   │
│   └── utils/
│       ├── pagination.ts             # Cursor-based pagination helpers
│       ├── filtering.ts              # Dynamic WHERE clause builder
│       └── errors.ts                 # TPS-specific error types
│
├── test/
│   ├── setup.ts                      # Test database setup + connection
│   ├── helpers.ts                    # Test data factories
│   │
│   ├── client/
│   │   ├── connection.test.ts
│   │   └── tps-client.test.ts
│   │
│   ├── crud/
│   │   ├── agents.test.ts
│   │   ├── permissions.test.ts
│   │   └── assignments.test.ts
│   │
│   ├── intelligence/
│   │   ├── effective-permissions.test.ts
│   │   ├── sod-analysis.test.ts
│   │   ├── blast-radius.test.ts
│   │   ├── permission-overlap.test.ts
│   │   ├── coverage-gaps.test.ts
│   │   ├── tool-inventory.test.ts
│   │   ├── risk-scoring.test.ts
│   │   └── audit-replay.test.ts
│   │
│   ├── rules/
│   │   ├── rule-evaluator.test.ts
│   │   └── evaluators/
│   │       ├── no-access-to-resource-type.test.ts
│   │       ├── max-sensitive-resource-count.test.ts
│   │       └── requires-approval-for-action.test.ts
│   │
│   └── export/
│       └── sanna-exporter.test.ts
│
└── docs/
    ├── API.md                        # Full API reference
    ├── RULE-CONDITIONS.md            # Catalog of rule condition types with schemas
    └── SANNA-EXPORT.md              # Sanna constitution export mapping reference
```

## Technical Decisions

### Database Driver

Use `postgres` (postgres.js / postgresjs) — not `pg` (node-postgres). Reasons:
- Faster than pg for prepared statements and pipeline queries
- Native ESM support
- Better TypeScript types
- Tagged template literal API prevents SQL injection by default
- Supports `LISTEN/NOTIFY` for future event-driven features

Install: `pnpm add postgres`

```typescript
import postgres from 'postgres';

const sql = postgres({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  username: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});
```

### Transaction Context Manager

Every governance operation must run inside a transaction that sets the session variables:

```typescript
interface TpsContext {
  actor: string;      // maps to SET LOCAL tps.current_actor
  role: TpsRole;      // maps to SET LOCAL tps.role
}

type TpsRole = 'system_admin' | 'governance_admin' | 'agent_operator' | 'auditor' | 'read_only_observer';

async function withTpsContext<T>(
  sql: postgres.Sql,
  ctx: TpsContext,
  fn: (sql: postgres.TransactionSql) => Promise<T>
): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`SELECT set_config('tps.current_actor', ${ctx.actor}, true)`;
    await tx`SELECT set_config('tps.role', ${ctx.role}, true)`;
    return fn(tx);
  });
}
```

This is the foundation of the entire library. Every CRUD operation and every intelligence query goes through `withTpsContext`. The `true` argument to `set_config` makes the setting local to the transaction.

### Type System

Mirror the PostgreSQL schema as TypeScript types. Every enum becomes a union type. Every table becomes an interface. Every function return type becomes a typed result.

```typescript
// Enums — mirror governance schema exactly
type AgentLifecycleState = 'proposed' | 'under_review' | 'approved' | 'active' | 'suspended' | 'decommissioned';
type AgentType = 'orchestrator' | 'worker' | 'autonomous' | 'human_in_the_loop';
type ResourceType = 'database' | 'table' | 'column' | 'api_endpoint' | 'webhook' | 'file_store' | 'mcp_server' | 'external_service' | 'queue' | 'secret_store' | 'model_endpoint';
type SensitivityClassification = 'public' | 'internal' | 'confidential' | 'restricted' | 'critical';
type DataCategory = 'pii' | 'phi' | 'financial' | 'intellectual_property' | 'authentication_credential' | 'system_configuration' | 'audit_data' | 'customer_data' | 'employee_data';
type ActionType = 'read' | 'write' | 'create' | 'delete' | 'execute' | 'admin' | 'approve' | 'delegate';
type GrantType = 'allow' | 'deny';
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational';
type ViolationAction = 'deny' | 'flag_for_review' | 'require_approval' | 'alert' | 'log_only';
// ... all other enums from DATA-MODEL-REFERENCE.md

// Table interfaces
interface Agent {
  id: string;
  name: string;
  version: string | null;
  description: string | null;
  purpose: string;
  lifecycle_state: AgentLifecycleState;
  agent_type: AgentType;
  parent_agent_id: string | null;
  product_id: string | null;
  delegation_scope: Record<string, unknown> | null;
  owner: string;
  contact: string | null;
  last_review_at: Date | null;
  review_cycle_days: number | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

// Function return types
interface EffectivePermission {
  permission_id: string;
  role_id: string;
  role_name: string;
  role_depth: number;
  resource_id: string;
  tool_id: string | null;
  actions: ActionType[];
  conditions: Record<string, unknown> | null;
  grant_type: GrantType;
  expires_at: Date | null;
}

// Net effective access — computed by this library, not the database
interface NetPermission {
  resource_id: string;
  tool_id: string | null;
  allowed_actions: ActionType[];
  denied_actions: ActionType[];
  net_actions: ActionType[];           // allowed minus denied
  conditions: Record<string, unknown>[];
  grant_lineage: PermissionLineage[];  // which roles granted/denied each action
}

interface PermissionLineage {
  action: ActionType;
  grant_type: GrantType;
  role_name: string;
  role_depth: number;
  permission_id: string;
}
```

Create complete type definitions for ALL tables and function return types in the schema. Reference `docs/DATA-MODEL-REFERENCE.md` for the full list.

---

## Core Features — Implementation Specifications

### Feature 1: TPS Client

The main entry point. Users instantiate a `TpsClient` and call methods on it.

```typescript
import { TpsClient } from '@tpsdev/governance-engine';

const tps = new TpsClient({
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'governance_dev',
    username: 'postgres',
    password: 'postgres',
  },
  // OR pass an existing postgres.js instance:
  // sql: existingSqlInstance,
});

// All operations require a context
const ctx = { actor: 'alice@example.com', role: 'governance_admin' as const };

// CRUD
const agent = await tps.agents.create(ctx, {
  name: 'payment-processor',
  purpose: 'Process customer payments via Stripe',
  agent_type: 'worker',
  owner: 'payments-team',
});

// Intelligence
const netPerms = await tps.intelligence.netEffectivePermissions(ctx, agent.id);
const sodViolations = await tps.intelligence.sodCheck(ctx, agent.id);
const blastRadius = await tps.intelligence.blastRadius(ctx, agent.id);
const tools = await tps.intelligence.toolInventory(ctx, agent.id);

// Rule evaluation
const violations = await tps.rules.evaluate(ctx, agent.id);
const complianceReport = await tps.rules.complianceCheck(ctx, { framework: 'GDPR' });

// Sanna export
const constitution = await tps.export.toSannaConstitution(ctx, agent.id);

// Cleanup
await tps.close();
```

The client should be structured with sub-objects for each domain:
- `tps.agents` — agent CRUD
- `tps.resources` — resource CRUD
- `tps.tools` — tool CRUD
- `tps.roles` — role CRUD
- `tps.permissions` — permission CRUD
- `tps.assignments` — agent-role assignment CRUD
- `tps.rules` — rule CRUD + evaluation
- `tps.ruleSets` — rule set CRUD
- `tps.compliance` — compliance framework + requirement CRUD
- `tps.sodConstraints` — SoD constraint CRUD
- `tps.mcpServers` — MCP server CRUD
- `tps.products` — product CRUD
- `tps.riskAssessments` — risk assessment CRUD
- `tps.intelligence` — governance intelligence queries
- `tps.export` — Sanna export and other export formats
- `tps.audit` — audit log queries and replay

### Feature 2: Net Effective Access Computation

This is the most important feature in the library. The database function `effective_permissions()` returns raw grants (both allow and deny). This library must compute the net effective access per D002 and D024.

**Algorithm:**

1. Call `governance.effective_permissions(agent_id)` to get all raw grants
2. Filter out expired permissions (`expires_at < now()` — though the DB function should already do this)
3. Group by `(resource_id, tool_id)` combination
4. For each group:
   a. Collect all `allow` grants and their action arrays → union into `allowed_actions`
   b. Collect all `deny` grants and their action arrays → union into `denied_actions`
   c. Compute `net_actions = allowed_actions - denied_actions`
   d. Preserve the `grant_lineage` showing which role at which depth granted or denied each action
5. Return `NetPermission[]` sorted by resource sensitivity descending

**Edge cases to handle:**
- A deny on `['read', 'write']` combined with an allow on `['read', 'write', 'delete']` → net is `['delete']`
- A deny at depth 0 (direct role) and an allow at depth 2 (inherited) → deny wins regardless of depth
- A permission with `tool_id = null` denies an action on a resource; a permission with `tool_id = X` allows the same action on the same resource → the deny on "any tool" overrides the allow on the specific tool (broader deny wins)
- Permissions with ABAC `conditions` — include conditions in the output but do NOT attempt to evaluate them at this layer (conditions are runtime-evaluated, not statically resolvable)

### Feature 3: Rule Evaluation Engine

The `rules.condition` column stores JSON with a `"type"` discriminant (D001). This library implements evaluators for each condition type using a strategy pattern.

**Architecture:**

```typescript
// Registry of evaluators
interface RuleEvaluator {
  type: string;  // matches condition.type
  evaluate(ctx: EvaluationContext, condition: Record<string, unknown>): Promise<RuleResult>;
}

interface EvaluationContext {
  sql: postgres.TransactionSql;
  agentId?: string;
  resourceId?: string;
  productId?: string;
}

interface RuleResult {
  rule_id: string;
  rule_name: string;
  passed: boolean;
  severity: Severity;
  violation_action: ViolationAction;
  details: string;       // Human-readable explanation
  affected_entities: {    // What triggered the violation
    agent_ids?: string[];
    resource_ids?: string[];
    permission_ids?: string[];
  };
}
```

**Evaluators to implement (starter set based on D001 examples + Sanna mapping):**

| Condition Type | What It Checks |
|---|---|
| `no_access_to_resource_type` | No agent (except `except_roles`) has allow permissions on resources of the specified type |
| `max_sensitive_resource_count` | No agent has allow permissions on more than `max_count` resources at or above `sensitivity` |
| `requires_approval_for_action` | Every permission granting `action` on resources at or above `min_sensitivity` has `conditions.requires_approval = true` |
| `no_pii_output_leakage` | Every resource with data_category `pii` has a governing rule with violation_action `deny` or `require_approval` |
| `max_role_depth` | No role hierarchy exceeds `max_depth` levels |
| `no_unrestricted_access` | No agent has allow permissions with no tool scope (tool_id null) AND action includes `admin` or `delete` on resources above `min_sensitivity` |
| `require_review_cycle` | Every active agent has `review_cycle_days` set AND `last_review_at` is within the cycle |
| `delegation_scope_enforcement` | No sub-agent has permissions exceeding its parent's `delegation_scope` |

The evaluator registry must be extensible — users should be able to register custom evaluators for their own condition types.

**Evaluation flow:**

```typescript
// Evaluate all active rules against a specific agent
async function evaluateRulesForAgent(ctx: TpsContext, agentId: string): Promise<RuleResult[]> {
  // 1. Fetch all active rules (global + product-scoped + agent-scoped)
  // 2. For each rule, look up the evaluator by condition.type
  // 3. Call evaluator.evaluate() with the appropriate context
  // 4. Collect and return results, sorted by severity descending
}

// Evaluate all active rules globally (no agent filter)
async function evaluateAllRules(ctx: TpsContext): Promise<RuleResult[]> {
  // Same but evaluates every active rule across the whole governance state
}

// Compliance check — evaluate rules linked to a specific framework
async function complianceCheck(ctx: TpsContext, opts: { framework?: string; frameworkId?: string }): Promise<ComplianceReport> {
  // 1. Fetch compliance requirements for the framework
  // 2. For each requirement, fetch linked rules via rule_compliance_reqs
  // 3. Evaluate each linked rule
  // 4. Aggregate: requirement status = met (all pass), partially_met (some pass), not_met (all fail), not_applicable (no rules linked)
  // 5. Return structured report with per-requirement results
}
```

### Feature 4: Point-in-Time Reconstruction (Audit Replay)

The audit log captures JSON snapshots of every governance state change (D004, D008). This library replays the log to reconstruct past state.

```typescript
interface PointInTimeQuery {
  entity_type: string;     // e.g., 'governance.agents'
  entity_id: string;       // UUID
  as_of: Date;             // Reconstruct state at this timestamp
}

interface PointInTimeResult<T> {
  entity_type: string;
  entity_id: string;
  as_of: Date;
  state: T | null;         // null if entity didn't exist at that time
  reconstructed_from: {
    audit_events_count: number;
    earliest_event: Date;
    latest_event_before_as_of: Date;
  };
}
```

**Algorithm:**
1. Query `audit_log` for all events on `(entity_type, entity_id)` where `occurred_at <= as_of`, ordered by `occurred_at DESC`
2. Take the most recent event
3. If the most recent event is a DELETE → entity didn't exist at that time (or was deleted before `as_of`)
4. If the most recent event is an INSERT or UPDATE → return `new_state` as the reconstructed state
5. If no events exist before `as_of` → entity didn't exist at that time

**For complex reconstruction** ("what could Agent X do last Tuesday?"):
1. Reconstruct agent state at `as_of`
2. Reconstruct all `agent_role_assignments` for that agent at `as_of`
3. Reconstruct all `permissions` for the assigned roles at `as_of`
4. Reconstruct role hierarchy at `as_of`
5. Compute effective permissions from the reconstructed state
6. This is expensive — document it as such and provide progress callbacks

### Feature 5: Sanna Constitution Export

Convert the TPS permission model for a specific agent into a Sanna Protocol v1.4 compatible YAML constitution. Reference `docs/SANNA-PROTOCOL-NOTES.md` for the complete mapping.

**Mapping:**

| TPS Entity | Sanna Section |
|---|---|
| `agents` (name, purpose) | `identity` (agent_name, description) |
| `products` | `identity.domain` |
| `permissions` with `grant_type = 'allow'` | `authority_boundaries.can_execute` |
| `permissions` with `grant_type = 'deny'` | `authority_boundaries.cannot_execute` |
| `permissions` with `conditions.requires_approval` | `authority_boundaries.must_escalate` |
| `rules` | `boundaries` + `invariants` |
| `tools` with `tool_type = 'api_call'` | `api_permissions.endpoints[]` |
| `tools` with `tool_type = 'custom'` | `cli_permissions.commands[]` |
| `resources` sensitivity → trust tier mapping | `trust_tiers` (autonomous/requires_approval/prohibited) |
| `rules` severity + violation_action | `halt_conditions` (for critical + deny) |

**Output format:**
```yaml
# TPS Constitution Export
# Agent: payment-processor
# Generated: 2026-04-27T12:00:00Z
# Source: @tpsdev/governance-engine v0.1.0

constitution_version: "1.4"

identity:
  agent_name: payment-processor
  domain: payments
  description: "Process customer payments via Stripe"

boundaries:
  - id: R001
    description: "Agent may only read data autonomously"
    category: scope
    severity: high

authority_boundaries:
  can_execute:
    - "stripe_create_charge"
    - "stripe_read_balance"
  cannot_execute:
    - "database_drop_*"
  must_escalate:
    - condition: "Refund exceeding $500"
      target:
        type: human
        contact: "payments-team-lead@example.com"

# ... full constitution
```

Use `yaml` (js-yaml) for YAML serialization. Do NOT use string concatenation to build YAML.

**Export function also returns:**
- `policy_hash`: SHA-256 of the canonical YAML content (for Sanna receipt verification)
- `export_metadata`: timestamp, engine version, agent snapshot, rule count

### Feature 6: Automated Risk Scoring

Compute risk scores for agents based on their permission profile. This writes results to `governance.risk_assessments`.

**Risk factors (each contributes to the score):**

| Factor | Weight | Trigger |
|---|---|---|
| `unrestricted_admin_access` | 5 | Agent has `admin` action on any resource with no tool scope |
| `destructive_tool_access` | 4 | Agent can use tools where `is_destructive = true` |
| `pii_data_access` | 4 | Agent has access to resources with `data_category = 'pii'` |
| `critical_resource_access` | 4 | Agent has access to `sensitivity = 'critical'` resources |
| `high_blast_radius` | 3 | Agent can reach more than N resources (configurable threshold) |
| `deep_delegation_chain` | 3 | Agent is more than 3 levels deep in the hierarchy |
| `sod_violation` | 5 | Agent currently violates an active SoD constraint |
| `overdue_review` | 2 | Agent's `last_review_at` + `review_cycle_days` < now |
| `broad_role_assignment` | 3 | Agent has more than N roles (configurable threshold) |
| `expired_permissions_present` | 1 | Agent has expired but not-revoked assignments |
| `no_governing_rules` | 3 | No active rules scoped to this agent or its product |

**Scoring algorithm:**
1. Evaluate all factors, collecting those that trigger
2. Risk score = max(triggered_factor_weights) (not sum — a single critical factor dominates)
3. Risk level = map score to `negligible(1) / low(2) / moderate(3) / high(4) / critical(5)`
4. Store result in `governance.risk_assessments` with `assessment_method = 'automated'`
5. Return the assessment with all contributing factors

---

## CRUD Operation Patterns

All CRUD operations follow these patterns:

### Create
```typescript
interface CreateAgentInput {
  name: string;
  purpose: string;
  agent_type: AgentType;
  owner: string;
  // ... all required fields, optional fields with defaults omitted
  version?: string;
  description?: string;
  parent_agent_id?: string;
  product_id?: string;
  // etc.
}

async function createAgent(ctx: TpsContext, input: CreateAgentInput): Promise<Agent> {
  return withTpsContext(sql, ctx, async (tx) => {
    const [agent] = await tx`
      INSERT INTO governance.agents ${tx(input)}
      RETURNING *
    `;
    return agent as Agent;
  });
}
```

### Read (with filtering and pagination)
```typescript
interface ListAgentsOptions {
  lifecycle_state?: AgentLifecycleState | AgentLifecycleState[];
  agent_type?: AgentType;
  product_id?: string;
  parent_agent_id?: string | null;  // null = top-level agents only
  search?: string;                   // fuzzy match on name/purpose
  limit?: number;                    // default 50
  cursor?: string;                   // cursor-based pagination (encoded created_at + id)
}

async function listAgents(ctx: TpsContext, opts?: ListAgentsOptions): Promise<PaginatedResult<Agent>> {
  // Build dynamic WHERE clause from options
  // Use cursor-based pagination (not OFFSET — OFFSET is O(n) on large tables)
  // Return { items: Agent[], next_cursor: string | null, total_count: number }
}
```

### Update
```typescript
async function updateAgent(ctx: TpsContext, id: string, input: Partial<CreateAgentInput>): Promise<Agent> {
  // Only update provided fields
  // updated_at is handled by the database or trigger
  // Return the full updated entity
}
```

### Delete
```typescript
async function deleteAgent(ctx: TpsContext, id: string): Promise<void> {
  // The schema uses ON DELETE RESTRICT — this will throw if the agent has
  // active role assignments, is a parent of other agents, etc.
  // Catch the FK violation error and throw a descriptive TPS error with
  // the blocking dependencies listed
}
```

---

## Error Handling

Define TPS-specific error classes:

```typescript
class TpsError extends Error {
  constructor(message: string, public code: string, public details?: Record<string, unknown>) {
    super(message);
    this.name = 'TpsError';
  }
}

class TpsNotFoundError extends TpsError { /* entity not found */ }
class TpsConflictError extends TpsError { /* unique constraint violation */ }
class TpsDependencyError extends TpsError { /* FK violation on delete — includes blocking deps */ }
class TpsPermissionError extends TpsError { /* RLS blocked the operation */ }
class TpsValidationError extends TpsError { /* input validation failed */ }
class TpsRuleViolationError extends TpsError { /* a governance rule was violated */ }
```

Catch PostgreSQL error codes and map them to TPS errors:
- `23505` (unique_violation) → `TpsConflictError`
- `23503` (foreign_key_violation) → `TpsDependencyError`
- `42501` (insufficient_privilege) → `TpsPermissionError`

---

## Testing Strategy

### Test Database
Tests run against a real PostgreSQL instance with the `@tpsdev/governance-core` schema deployed. Use Docker:

```bash
# Start test database
docker run -d --name tps-test-db -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:16

# Deploy schema (from governance-core)
PGHOST=localhost PGPORT=5433 PGUSER=postgres PGPASSWORD=test pgpm deploy --createdb --database tps_test
```

### Test Isolation
Each test gets a transaction that rolls back after the test:

```typescript
import postgres from 'postgres';

let sql: postgres.Sql;

beforeAll(async () => {
  sql = postgres({ host: 'localhost', port: 5433, database: 'tps_test', username: 'postgres', password: 'test' });
});

afterAll(async () => {
  await sql.end();
});

// Each test runs in a rolled-back transaction
function withTestTransaction(fn: (tx: postgres.TransactionSql) => Promise<void>) {
  return async () => {
    await sql.begin(async (tx) => {
      // Set context
      await tx`SELECT set_config('tps.current_actor', 'test-harness', true)`;
      await tx`SELECT set_config('tps.role', 'system_admin', true)`;
      await fn(tx);
      // Force rollback by throwing after test completes
      throw new RollbackSignal();
    }).catch((e) => {
      if (!(e instanceof RollbackSignal)) throw e;
    });
  };
}
```

### Test Data Factories
Create factory functions that generate valid test entities with sensible defaults:

```typescript
function createTestAgent(overrides?: Partial<CreateAgentInput>): CreateAgentInput {
  return {
    name: `test-agent-${randomSuffix()}`,
    purpose: 'Test agent for automated testing',
    agent_type: 'worker',
    owner: 'test-harness',
    ...overrides,
  };
}
```

### Test Coverage Requirements
Every feature must have tests covering:
- Happy path (correct usage produces correct results)
- Edge cases (empty inputs, null values, boundary conditions)
- Error cases (invalid inputs, FK violations, RLS blocks)
- The deny-overrides-allow edge cases listed in Feature 2
- Rule evaluation with both passing and failing conditions
- Audit replay accuracy (reconstruct a known state, verify it matches)

---

## What NOT to Build

- No HTTP API server — this is a library, not a service
- No CLI tool — that may come later as `@tpsdev/cli`
- No UI components — that's Layer 3
- No real-time enforcement proxy — that's Sanna's job
- No LLM integration — rules are deterministic
- No Ed25519 signing — Sanna handles cryptographic operations
- No database migrations — the schema is managed by `@tpsdev/governance-core` via pgpm

## Dependencies

```json
{
  "dependencies": {
    "postgres": "^3.4.0",
    "yaml": "^2.4.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "@types/node": "^20.0.0"
  },
  "peerDependencies": {
    "@tpsdev/governance-core": ">=0.1.0"
  }
}
```

Keep dependencies minimal. Do NOT add ORMs (Prisma, Drizzle, TypeORM). The postgres.js tagged template API is sufficient and keeps queries explicit and auditable — governance code should not have magic query generation.

## Multi-Language Note

A Python SDK (`tpsdev` on PyPI) will be built as a parallel client against the same schema. The governance intelligence logic (deny-overrides-allow, rule evaluation, risk scoring) must be reimplemented in Python — it cannot share TypeScript code. However, the database functions (`effective_permissions`, `sod_check`, `blast_radius`, `permission_overlap`, `coverage_gaps`, `agent_tool_inventory`) return identical results to both SDKs. The TypeScript SDK is the reference implementation; the Python SDK should produce identical outputs for the same inputs.

## Build Status

### Done (initial scaffold)
- [x] `src/client/types.ts` — every enum, table interface, and function-return type
- [x] `src/client/connection.ts` — postgres.js pool + `withTpsContext` / `withTpsReadOnly`
- [x] `src/client/tps-client.ts` — `TpsClient` composing all sub-APIs
- [x] `src/client/audit.ts` — read-only audit log queries
- [x] `src/utils/errors.ts` — `TpsError` hierarchy + `mapPostgresError`
- [x] `src/utils/pagination.ts` — cursor encode/decode + clamp
- [x] `src/utils/filtering.ts` — safe dynamic WHERE builder
- [x] `src/utils/crud-helpers.ts` — `getById`, `listPaginated`, `compact`, `DbConn`
- [x] `src/crud/*` — all 13 CRUD modules (agents, products, mcp-servers, resources, tools, roles, permissions, assignments, rules, rule-sets, compliance, sod-constraints, risk-assessments)
- [x] `src/intelligence/effective-permissions.ts` — `computeNetPermissions` with deny-overrides + broader-deny rule
- [x] `src/intelligence/sod-analysis.ts` — `check`, `report`, `listAllViolations`
- [x] `src/intelligence/blast-radius.ts` — `compute`, `summarize`, `atOrAbove`
- [x] `src/intelligence/permission-overlap.ts` — `forResource`, `forResourceAndAction`
- [x] `src/intelligence/coverage-gaps.ts` — `list`, `atOrAbove`
- [x] `src/intelligence/tool-inventory.ts` — `forAgent`, `destructiveForAgent`
- [x] `src/intelligence/risk-scoring.ts` — 11-factor scorer with `score` / `scoreAndPersist`
- [x] `src/intelligence/audit-replay.ts` — `reconstruct`, `agentAccessAsOf` with point-in-time net access
- [x] `src/rules/types.ts` — evaluator interface + condition type definitions
- [x] `src/rules/rule-evaluator.ts` — `RuleEvaluatorRegistry` + `RulesEngine` (`evaluate`, `complianceCheck`)
- [x] `src/rules/evaluators/*` — all 8 starter evaluators registered as `BUILT_IN_EVALUATORS`
- [x] `src/export/sanna-types.ts`, `src/export/yaml-serializer.ts`, `src/export/sanna-exporter.ts` — full TPS → Sanna v1.4 mapping with SHA-256 policy hash
- [x] `src/index.ts` — public API barrel
- [x] Package scaffold: `package.json`, `tsconfig.json`, `vitest.config.ts`, `README.md`, `.gitignore`
- [x] `test/helpers.ts` + 6 test files (26 unit tests, all passing) — covers `computeNetPermissions` deny-overrides edge cases, error mapping, cursor round-trip, evaluator registry, YAML determinism, filter safety
- [x] `docs/API.md`, `docs/RULE-CONDITIONS.md`, `docs/SANNA-EXPORT.md`
- [x] `tsc -p tsconfig.json` clean
- [x] `vitest run` — 26 / 26 passing

### Pending (requires running database)
- [ ] DB-backed integration tests for CRUD modules — agent create/update/delete, role hierarchy, permissions, assignments, rls policies
- [ ] DB-backed integration tests for intelligence — `effective_permissions` ↔ `computeNetPermissions` round-trip, `sod_check`, `blast_radius`, `agent_tool_inventory`, `coverage_gaps`, audit replay
- [ ] DB-backed integration tests for the eight rule evaluators
- [ ] DB-backed integration test for `toSannaConstitution` against a seeded agent
- [ ] `pnpm publish --dry-run` — verify the dist/ tarball shape

### Iteration Guidance
Start with types → connection → client skeleton → CRUD → then intelligence features in order. The rule evaluators and Sanna export can be built after the core intelligence features are working. Tests should be written alongside each feature, not after.

### Documentation Generation
At the end of the session, generate:
- `docs/API.md` — full API reference for every public method
- `docs/RULE-CONDITIONS.md` — catalog of all rule condition types with JSON schemas and examples
- `docs/SANNA-EXPORT.md` — the complete Sanna mapping reference
- Update this CLAUDE.md's Build Status to reflect what was completed
