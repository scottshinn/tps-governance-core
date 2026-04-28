# TPS — Project handoff briefing

**Audience:** anyone (engineer, contractor, or AI assistant) picking up this project to continue the work.

**Goal of this document:** get you oriented in 10 minutes and able to start a track in 30. Self-contained — does not assume prior context.

Last updated: 2026-04-27.

---

## 1. What this project is, in one paragraph

TPS (**Tool Permission System**) is a governance platform for AI agent deployments. It models the full permission, access, and compliance surface of an AI agent fleet as normalized PostgreSQL data, exposes that data through a typed TypeScript library with intelligence queries (deny-overrides resolution, blast radius, SoD detection, risk scoring, point-in-time reconstruction, Sanna constitution export), and renders an operator-facing visual control plane on top. The system is **authoring + observation**, not enforcement — Sanna is the runtime enforcement layer; TPS is what governance teams use to design the policy and watch it.

TPS answers: *"Across all of my agents, tools, and resources — who can do what, why are they allowed to, and where are the gaps?"*

---

## 2. Three-layer architecture

```
Layer 3 — @tpsdev/kya             Next.js operator UI (terminal-themed)
                                   ↓ imports
Layer 2 — @tpsdev/governance-engine TypeScript library — TpsClient, intelligence, rules, export
                                   ↓ SQL via postgres.js
Layer 1 — @tpsdev/governance-core   Postgres schema (pgpm module): tables, indexes, RLS,
                                    audit triggers, intelligence functions, seed data
```

**Hard rule:** Layer 3 never speaks SQL directly. Every read and write goes through `TpsClient` from Layer 2. The engine is the only data interface.

**Sanna note:** Sanna Protocol v1.4 is the runtime enforcement layer. AGPL-3.0. TPS does NOT copy or fork Sanna — it is the *authoring and management layer* that emits Sanna-compatible YAML constitutions for Sanna to enforce.

---

## 3. Current state — what is done, what is not

### Layer 1 — `@tpsdev/governance-core`

| Status | Item |
|---|---|
| ✅ | Schema written: 17 tables, 22 enum types, 6 intelligence functions, 6 views, RLS on agents + audit_log |
| ✅ | Audit trigger (`SECURITY DEFINER`) attached to all 17 mutable tables |
| ✅ | Seed data: 4 compliance frameworks (GDPR, EU AI Act, SOC 2, Internal Policy), 5 built-in roles, 4 SoD constraint templates |
| ✅ | 12 test files written using `pgsql-test` |
| ✅ | Documentation: `docs/ARCHITECTURE.md`, `docs/DATA-MODEL-REFERENCE.md`, `docs/PGPM-CONVENTIONS.md`, `docs/SANNA-PROTOCOL-NOTES.md`, `DECISIONS.md` (D001–D025) |
| ❌ | **Never deployed to a live database.** `pgpm deploy/verify/revert` cycle has never run end-to-end |
| ❌ | The 12 test files have never been executed against a deployed schema |

### Layer 2 — `@tpsdev/governance-engine`

| Status | Item |
|---|---|
| ✅ | `TpsClient` entry point + 13 CRUD modules (agents, products, mcp-servers, resources, tools, roles, permissions, assignments, rules, rule-sets, compliance, sod-constraints, risk-assessments) |
| ✅ | 8 intelligence modules (effective-permissions with deny-overrides resolver, sod-analysis, blast-radius, permission-overlap, coverage-gaps, tool-inventory, risk-scoring with 11 factors, audit-replay for point-in-time reconstruction) |
| ✅ | Rules engine: `RuleEvaluatorRegistry` + `RulesEngine` + 8 starter evaluators |
| ✅ | Sanna v1.4 constitution exporter with deterministic YAML and SHA-256 `policy_hash` |
| ✅ | KYA façade methods: `tps.intelligence.computeRiskScore`, `tps.rules.evaluate / complianceCheck`, `tps.audit.reconstructState`, `tps.audit.list({ from, to })`, `tps.riskAssessments.latest({...})` |
| ✅ | 32 unit tests passing, `tsc` clean. Tests cover deny-overrides edge cases, broader-deny override, error mapping, evaluator dispatch, YAML determinism, façade surface |
| ✅ | Docs: `packages/governance-engine/docs/{API,RULE-CONDITIONS,SANNA-EXPORT}.md` |
| ❌ | **No DB-backed integration tests.** The unit tests are pure-compute only — no actual database round-trip |

### Layer 3 — `@tpsdev/kya`

| Status | Item |
|---|---|
| ✅ | Next.js 15 + React 19 + Tailwind 4 scaffold |
| ✅ | Terminal design system: tokens in `app/globals.css` `@theme` block, full color palette + typography from the spec |
| ✅ | 17 components: StatusBadge, SeverityBadge, RiskScore, EntityLink, KyaCard, EmptyState, Breadcrumb, ComplianceProgress, SensitivityBar, JsonDiff, YamlPreview, AuditEvent, DataTable, FilterBar, ConfirmDialog, CommandPalette, Sidebar |
| ✅ | Pages: `/` (redirect), `/agents` (registry with filters + cursor pagination), `/agents/[id]` (KYA Card with 8 parallel `TpsClient` calls), `/agents/[id]/{permissions,tools,blast-radius,audit}` sub-pages, `/audit` (global timeline) |
| ✅ | Server Actions: `setAgentLifecycle`, `exportConstitution`, `runRiskAssessment`, `evaluateRulesForAgent` |
| ✅ | `lib/tps.ts` — server-side `TpsClient` singleton + env-var context (Phase 1, no auth) |
| ✅ | `next build` clean, typecheck clean, 7 routes server-rendered correctly |
| ❌ | Never run against a live database — no runtime verification |
| ❌ | No tests yet for KYA components |
| ❌ | Phase 2 surfaces: `/topology`, `/resources`, `/rules` |
| ❌ | Phase 3 surfaces: `/dashboard`, `/compliance` |
| ❌ | Phase 1 polish: loading skeletons, keyboard navigation in tables, "Reconstruct at..." dialog on audit timeline |

---

## 4. Repo layout

```
tps-governance-core/                         # workspace root, pnpm + lerna
├── CLAUDE.md                                 # current spec — Layer 3 (KYA) is the active focus
├── CLAUDE-prior-layer-1.md                   # prior CLAUDE.md (Layer 1 spec)
├── DECISIONS.md                              # 25 architecture decisions (D001–D025)
├── HANDOFF.md                                # this file
├── NEXT-STEPS.md                             # track index from earlier
├── README.md
├── docs/
│   ├── ARCHITECTURE.md                       # Layer 1 ER model + design principles
│   ├── DATA-MODEL-REFERENCE.md               # every table, column, function, view, enum
│   ├── PGPM-CONVENTIONS.md                   # pgpm deploy/verify/revert pattern
│   ├── SANNA-PROTOCOL-NOTES.md               # Sanna v1.4 surface, what TPS maps
│   ├── LAYER-2-VALIDATION.md                 # plan for Layer 2 DB integration tests
│   └── LAYER-3-KYA-SPEC.md                   # earlier proposal — superseded by CLAUDE.md
├── packages/
│   ├── governance-core/                      # Layer 1 — pgpm module
│   │   ├── package.json                      # @tpsdev/governance-core
│   │   ├── pgpm.plan                         # 40-entry DAG
│   │   ├── deploy/                           # SQL files
│   │   ├── verify/                           # mirror of deploy/, uses verify_* helpers
│   │   ├── revert/                           # mirror of deploy/, undoes each step
│   │   ├── seed/reference_data.sql
│   │   └── __tests__/                        # 12 pgsql-test specs
│   ├── governance-engine/                    # Layer 2 — TS library
│   │   ├── package.json                      # @tpsdev/governance-engine
│   │   ├── src/
│   │   │   ├── client/                       # TpsClient, connection, types, audit
│   │   │   ├── crud/                         # 13 CRUD modules
│   │   │   ├── intelligence/                 # 8 intelligence modules
│   │   │   ├── rules/                        # rule-evaluator + 8 evaluators
│   │   │   ├── export/                       # Sanna exporter
│   │   │   └── utils/                        # errors, pagination, filtering, crud-helpers
│   │   ├── test/                             # 32 unit tests, all pure compute
│   │   └── docs/{API,RULE-CONDITIONS,SANNA-EXPORT}.md
│   └── kya/                                  # Layer 3 — Next.js app
│       ├── package.json                      # @tpsdev/kya
│       ├── app/                              # App Router pages + server actions
│       ├── components/                       # 17 reusable components
│       ├── lib/                              # tps.ts singleton, format.ts helpers
│       └── README.md
├── package.json                              # workspace root
├── pnpm-workspace.yaml
└── lerna.json
```

---

## 5. Required reading order — for picking up cold

Read in this order before touching code. The whole set is ~1 hour.

1. **`CLAUDE.md`** — current active spec. As of this writing it is the Layer 3 (KYA) spec.
2. **`docs/ARCHITECTURE.md`** — Layer 1 entity-relationship model, design principles, function design. The five governance intelligence functions are the heart of TPS — understand what they answer.
3. **`docs/DATA-MODEL-REFERENCE.md`** — every table, column, enum, function, view. Skim now, return as needed.
4. **`DECISIONS.md`** — D001–D025. The most important ones for downstream work:
   - **D001** — Rule conditions are `jsonb` with a `"type"` discriminant. Layer 2 implements the evaluators.
   - **D002** — Deny-overrides-allow. Layer 2 computes the net effective access; the database returns raw allow + deny.
   - **D004** — Point-in-time reconstruction replays the audit log.
   - **D007** — `tps.role` session variable controls RLS.
   - **D016** — `tps.current_actor` session variable for audit attribution.
   - **D019** — `tool_id` nullable in permissions; null means "any tool"; broader-deny wins.
   - **D024** — `effective_permissions()` returns both allow and deny; Layer 2 computes the net.
   - **D025** — `agent_tool_inventory()` is tool-centric; use it for tool queries, not `blast_radius()`.
5. **`packages/governance-engine/docs/API.md`** — every public method on `TpsClient`. This is the contract Layer 3 builds against.
6. **`packages/governance-engine/docs/RULE-CONDITIONS.md`** — the eight starter evaluators and how to register custom ones.
7. **`packages/governance-engine/docs/SANNA-EXPORT.md`** — the TPS → Sanna mapping.
8. **`docs/SANNA-PROTOCOL-NOTES.md`** — only if you're touching the Sanna exporter or understanding why TPS exists alongside Sanna.

For Layer 3 specifically, also read:

9. **`packages/kya/README.md`** — current Phase 1 status checklist.
10. **`packages/kya/app/agents/[id]/page.tsx`** — exemplary KYA Card. Mirrors the eight-panel pattern from `CLAUDE.md`.

---

## 6. Outstanding work — independent tracks

These are independent. Different people / agents can take different tracks in parallel.

### Track A — Stand up a test database and verify Layer 1 + Layer 2 + Layer 3 end-to-end

**Highest leverage.** Unblocks every other downstream verification. Estimated effort: half a day.

**Prerequisites:** Postgres 16 (Docker is fine), `pgpm` CLI installed (`npm i -g pgpm` or workspace-local), `pnpm`.

**Steps:**

```sh
# 1. Start a test database
docker run -d --name tps-test-db -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:16

# 2. Deploy Layer 1
cd packages/governance-core
PGHOST=localhost PGPORT=5433 PGUSER=postgres PGPASSWORD=test \
  pgpm deploy --createdb --database tps_dev

# 3. Verify the deploy
PGHOST=localhost PGPORT=5433 PGUSER=postgres PGPASSWORD=test \
  pgpm verify --database tps_dev

# 4. Run Layer 1 tests (12 specs)
PGHOST=localhost PGPORT=5433 PGUSER=postgres PGPASSWORD=test \
  pnpm -C packages/governance-core run test

# 5. Verify clean revert
PGHOST=localhost PGPORT=5433 PGUSER=postgres PGPASSWORD=test \
  pgpm revert --database tps_dev

# 6. Re-deploy + load seed for Layer 2/3 work
pgpm deploy --createdb --database tps_dev
psql -h localhost -p 5433 -U postgres -d tps_dev -f packages/governance-core/seed/reference_data.sql
```

**Success criteria:**
- All 42 verify scripts return success
- All 12 Layer 1 test files pass
- Revert cleanly undoes the deploy
- A re-deploy + seed leaves the DB in a state where Layer 2 unit tests still pass and Layer 3 (`pnpm -C packages/kya dev`) can connect

**Likely issues to watch for:**
- pgpm `requires:` headers may have a typo causing wrong execution order — fix in the offending SQL file
- Verify scripts depend on `verify_*` helpers from `pgsql-test`; if missing, ensure dev deps installed at workspace root
- `pgcrypto`, `uuid-ossp`, `citext`, `pg_trgm`, `btree_gist` extensions must be installable on the target Postgres

---

### Track B — Layer 2 DB-backed integration tests

**Estimated effort:** 2–4 days. **Blocks:** publishing `@tpsdev/governance-engine@0.1.0`.

**Plan:** see `docs/LAYER-2-VALIDATION.md` for the full per-module breakdown. Summary:

1. `packages/governance-engine/test/setup.ts` — shared postgres.js instance from env vars
2. `packages/governance-engine/test/helpers/db.ts` — transaction-rollback wrapper that begins a tx, sets `tps.current_actor` + `tps.role`, runs the test, then forces rollback so seed data stays intact
3. `packages/governance-engine/test/helpers/factories.ts` — `newAgent`, `newResource`, `newTool`, `newPermission`, etc.
4. **Per-module specs** (see `docs/LAYER-2-VALIDATION.md` for the full table):
   - Track A: 13 CRUD modules — happy path, FK violation, conflict, NotFound, audit trail, pagination, filters
   - Track B: 8 intelligence modules — fixture graphs + assertions
   - Track C: 8 rule evaluators — pass case + fail case + `affected_entities` shape
   - Track D: Sanna export — snapshot test + determinism test (re-export with no changes → identical `policy_hash`)

**Success criteria:** all integration tests pass; `pnpm -C packages/governance-engine run test` runs both unit and integration suites; CI workflow at `.github/workflows/governance-engine.yml` (template in `docs/LAYER-2-VALIDATION.md`).

**Done-when:** ready to run `pnpm publish --dry-run` on Layer 2.

---

### Track C — KYA Phase 1 polish

**Estimated effort:** 1–2 days. Pure UX work, no schema or engine changes.

**Items (each independent):**

1. **Loading skeletons** — every page has at least one `Suspense` boundary, fall back to skeleton components matching the actual content shape (pulsing `bg-kya-bg-tertiary` blocks). Templates: `AgentCardSkeleton`, `DataTableSkeleton`, `AuditTimelineSkeleton`. Files to touch: `packages/kya/components/skeletons/*.tsx` (new), `packages/kya/app/agents/[id]/page.tsx` (wrap each panel).
2. **Keyboard navigation in DataTable** — arrow keys move focus between rows, Enter activates the first link in the focused row, `/` focuses the FilterBar search input, Esc clears search. Implement as a client wrapper around `DataTable`. File: `packages/kya/components/InteractiveDataTable.tsx` (new); use it on `/agents` and the audit pages.
3. **`Reconstruct at...` dialog on `/audit`** — date-time picker; when submitted calls `tps.audit.reconstructState(ctx, { entity_type, entity_id, as_of })` via a server action. Display result in a modal. The engine method already exists.
4. **Error boundaries** — `app/agents/error.tsx`, `app/audit/error.tsx`, root `app/error.tsx`. Render `TpsError.code` (`TPS_NOT_FOUND`, `TPS_PERMISSION`, etc.) with friendly messages.
5. **Component tests** — Vitest + React Testing Library for the leaf components: `StatusBadge`, `SeverityBadge`, `JsonDiff`, `SensitivityBar`. The pure-compute logic in `JsonDiff` (INSERT/DELETE/UPDATE branches, `updated_at` suppression) is the highest-value coverage.

**Success criteria:** every page has a Suspense boundary, all tables are keyboard-navigable, audit timeline can reconstruct any historical state.

---

### Track D — KYA Phase 2 surfaces

**Estimated effort:** 4–6 days. Builds on Phase 1; no engine changes needed.

#### `/topology` — agent hierarchy graph

- Use `react-flow` (already a dep candidate; add to `package.json` if not present)
- Data source: `tps.agents.list(ctx, {})` + build adjacency from `parent_agent_id`. For metadata, use `governance.agent_summary` view (Layer 2 doesn't expose it yet — add `tps.intelligence.agentSummary()` method, mirrors view query)
- Nodes colored by lifecycle state and risk badge
- Click node → `/agents/[id]`
- Filter by product

#### `/resources` — resource explorer

- Table from `tps.resources.list(ctx, filters)`
- Filter chips: resource_type, sensitivity, data_category, product, "ungoverned only" toggle (last one calls `tps.intelligence.coverageGaps`)
- Side panel on click: `tps.intelligence.permissionOverlap(ctx, resource_id)` results — every agent with allow access

#### `/rules` — rule management

- Table from `tps.rules.list(ctx)`
- Create/edit form that builds a `condition` jsonb from a `type` dropdown + dynamic per-type fields (use the catalog from `RULE-CONDITIONS.md`)
- Toggle status (`draft` ↔ `active` ↔ `disabled`)
- "Run" button per rule → calls `tps.rules.evaluate(ctx, { ... })` filtered to that rule, shows pass/fail + `affected_entities`
- Link rules to compliance requirements via `tps.rules.linkRequirement` (already in Layer 2)

**Success criteria:** all three Phase 2 surfaces functional against a seeded DB; sidebar items go from `(soon)` to active.

---

### Track E — KYA Phase 3 surfaces

**Estimated effort:** 2–3 days. Builds on Phase 2.

#### `/dashboard`

Single-screen overview composed from existing `TpsClient` calls:
- SoD violations count + list — `tps.intelligence.sod.listAllViolations(ctx)` (already exists)
- Ungoverned resources count + list — `tps.intelligence.coverageGaps(ctx)`
- Risk distribution — bar chart from `tps.riskAssessments.list(ctx)` aggregated by `risk_level`
- Review status — count of agents with `reviewStatus(...) === 'overdue'`
- Compliance coverage — one row per framework, `tps.rules.complianceCheck(ctx, { framework })`
- Recent activity — last 5 events from `tps.audit.list(ctx, { limit: 5 })`

Use `recharts` (per spec) for the bar chart; everything else is composable from existing components.

#### `/compliance`

- Framework picker → `tps.rules.complianceCheck(ctx, { framework })` → structured report
- Per-requirement breakdown: requirement, linked rules, evaluation results
- Markdown export button (PDF deferred per spec)

**Success criteria:** all sidebar items active; KYA at feature parity with the CLAUDE.md spec.

---

### Track F — Authentication (Phase 3+)

**Estimated effort:** 2–3 days. Currently env-var-driven, single-operator.

**Plan:**
1. Pick an OIDC provider (Auth.js / NextAuth / Clerk — Auth.js is the most workspace-neutral)
2. Replace `getDefaultContext()` in `lib/tps.ts` with a session-driven resolver
3. Add an IdP group → `tps.role` mapping table (configurable, defaults documented in `docs/LAYER-3-KYA-SPEC.md`)
4. Add a `/auth/login` page; gate every page through middleware
5. Mutations now attribute to the real operator email, not `kya-operator`

**Success criteria:** every audit log entry written by a KYA mutation has the operator's email in `actor`, RLS scopes data per the operator's mapped role.

---

### Track G — Python SDK (`tpsdev` on PyPI)

**Estimated effort:** 1–2 weeks. **Not blocking** Layer 3 functionality, but eventually expected.

**Pattern:**
- Mirror the `TpsClient` surface in Python using psycopg3 or asyncpg
- Reuse the database functions for `effective_permissions`, `sod_check`, `blast_radius`, `permission_overlap`, `coverage_gaps`, `agent_tool_inventory` — only the resolver/scorer/evaluators need re-implementation
- The deny-overrides resolver, risk scoring, and rule evaluators should produce identical outputs to TypeScript for the same inputs
- Cross-language conformance tests: same fixtures, same outputs

**Reference:** the resolver logic is in `packages/governance-engine/src/intelligence/effective-permissions.ts` (`computeNetPermissions` is pure and easy to port). Risk scoring is in `risk-scoring.ts`. Evaluators are in `src/rules/evaluators/`.

---

## 7. Critical conventions

### Coding style

- **TypeScript strict mode** in Layer 3; Layer 2 uses workspace `strictNullChecks: false` (intentional, mirrors a few permissive postgres.js typings).
- **No emojis** in code or generated docs unless explicitly requested.
- **Comments only when the WHY is non-obvious.** Don't explain WHAT.
- **No backwards-compatibility shims** in this codebase. Pre-publish, change shapes freely.

### Database conventions

- Every governed table has the `governance_private.tg_audit_log` trigger attached.
- All operations must run inside a transaction with `SET LOCAL tps.current_actor = ...` and `SET LOCAL tps.role = ...`. Layer 2's `withTpsContext` does this automatically.
- `ON DELETE RESTRICT` everywhere governance data shouldn't silently cascade.
- All primary keys are `uuid DEFAULT gen_random_uuid()`.
- All timestamps are `timestamptz DEFAULT now()`.
- Enums for fixed taxonomies; `text` for variable strings (no `varchar(n)` unless intentional).

### Layer 2 conventions

- Every CRUD module exposes: `create`, `get`, `list` (cursor-paginated), `update`, `delete`. Plus entity-specific helpers.
- `list` always returns `{ items, next_cursor }`.
- Errors: postgres codes are mapped — `23505` → `TpsConflictError`, `23503` → `TpsDependencyError`, `42501` → `TpsPermissionError`, `23502/23514/22P02` → `TpsValidationError`. Missing rows → `TpsNotFoundError`.
- Tests using `pgsql-test` should use the transaction-rollback wrapper so they don't pollute the seed.

### Layer 3 conventions

- **Server Components for data fetching, Server Actions for mutations.** No client-side data fetching unless absolutely required (e.g., real-time updates — and that's Phase 2+).
- **URL search params drive filter / pagination state.** Pages are bookmarkable. Back button works.
- **All mutations call `revalidatePath(...)`** so the next render reflects the new state.
- **No light mode.** This is a dark, dense, terminal-feeling ops tool. Use the `--color-kya-*` tokens from `app/globals.css`.
- **No rounded corners.** No drop shadows. No bouncing animations.

---

## 8. Build / test / run commands

```sh
# Workspace root
pnpm install
pnpm build                    # all packages
pnpm test                     # all packages

# Layer 1
pnpm -C packages/governance-core run test
PGHOST=localhost PGPORT=5433 ... pgpm deploy --createdb --database tps_dev
PGHOST=localhost PGPORT=5433 ... pgpm verify --database tps_dev
PGHOST=localhost PGPORT=5433 ... pgpm revert --database tps_dev

# Layer 2
pnpm -C packages/governance-engine run build       # tsc
pnpm -C packages/governance-engine run test        # vitest, 32 unit tests

# Layer 3
pnpm -C packages/kya run typecheck                 # tsc --noEmit
pnpm -C packages/kya run dev                       # next dev → localhost:3000
pnpm -C packages/kya run build                     # next build (production)
pnpm -C packages/kya run start                     # next start
```

### Required env vars for Layer 3 (and Layer 2 integration tests)

```env
TPS_DB_HOST=localhost
TPS_DB_PORT=5433              # or 5432 — match your Postgres
TPS_DB_NAME=tps_dev
TPS_DB_USER=postgres
TPS_DB_PASSWORD=test
TPS_DEFAULT_ACTOR=kya-operator
TPS_DEFAULT_ROLE=governance_admin
```

Template at `packages/kya/.env.example`. Integration-test env vars described in `docs/LAYER-2-VALIDATION.md`.

---

## 9. Known issues and gotchas

1. **postgres.js typing constraints.** The `Sql<{}>` and `TransactionSql<{}>` types in postgres.js v3 are narrow. Layer 2's CRUD helpers use a loose `DbConn = any` alias — this is intentional. See `packages/governance-engine/src/utils/crud-helpers.ts`. Don't tighten this without a plan.
2. **Dynamic helper insertion.** Inserting a `Record<string, unknown>` via postgres.js's `sql(obj)` helper requires the object to satisfy `ParameterOrJSON<never>` per column. The `compact(input)` helper returns `Record<string, never>` to satisfy this. Don't change the cast.
3. **`updated_at` noise in audit diffs.** Every `UPDATE` bumps `updated_at`, which dirties the audit log diff. `JsonDiff` filters this key. Don't surface it to operators.
4. **N+1 in `/agents`.** The agent registry enriches each row with one `assignments.list` call and one `riskAssessments.latest` call. Fine for hundreds of agents; degrades around thousands. Phase 2 should swap to a single `governance.agent_summary` view query (Layer 2 doesn't expose it yet — add `tps.intelligence.agentSummary()`).
5. **No live DB verification.** Nothing in this project has been run against a real database. Track A above is the unblocker for everything downstream.
6. **`tps.role = 'system_admin'` bypasses RLS-scoped reads.** Phase 1's default role for KYA is `governance_admin`, which is correct for an operator UI. Don't change to `system_admin` unless you understand what you're widening.
7. **Sanna identity claims and provenance signature blocks are not in Layer 1.** The Sanna exporter omits these sections. If you need them, the schema needs a migration first (`agents.identity_claims` jsonb + per-assignment approval signatures). Track that as a separate workstream.
8. **CommandPalette only does page jumps in Phase 1.** Agent search via `tps.agents.list({ search })` is Phase 2.

---

## 10. Why this project exists (the elevator pitch)

AI agent deployments are exploding in scope: orchestrators delegating to sub-agents, MCP servers exposing dozens of tools, agents reaching across PII databases, payment APIs, and credential stores. No existing tool can answer **"across all of my agents, who can do what, why, and where are the gaps?"** That question is a regulator's first question. It's also the security team's first question. It's also the question that determines whether you can ship an AI feature in a regulated industry.

TPS is the data layer + intelligence library + visual control plane that answers it. Layer 1 models the surface. Layer 2 makes it queryable. Layer 3 makes it visible.

Sanna enforces. TPS authors. They're complementary.

---

## 11. Contact

The original author is Scott Shinn (sshinn@gmail.com). The project is MIT-licensed.

If you're picking this up to continue: read `CLAUDE.md` first, then `DECISIONS.md`, then start with Track A. That sequence will save you the most time.
