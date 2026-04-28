# Layer 3 — TPS KYA — preliminary spec

**Status:** proposal. Nothing here is committed yet. The user should redirect on tech choices and surface scope before implementation begins.

KYA = "Know Your Agent." The visual control plane for governance operators sitting on top of `@tpsdev/governance-engine`.

---

## What KYA is for

TPS answers "who can do what, why, and where are the gaps?" Layer 1 stores the answers as relational data. Layer 2 makes them queryable in code. Layer 3 makes them **visible**.

The audience is a governance operator — not a developer. They're triaging questions like:

- "Show me every agent with access to PII."
- "Why does this agent have admin on production?"
- "Did anyone touch the GDPR rule set this week?"
- "What would happen if I revoked this role from `payments-orchestrator`?"
- "Which sub-agents are exceeding their parent's delegation scope right now?"

KYA answers these without the operator writing SQL or TypeScript. It's the difference between "TPS exists" and "TPS gets used."

KYA is **not** an enforcement engine. It's a control plane for authoring, observing, and intervening on governance state. Sanna remains the runtime enforcement boundary.

---

## Hard boundaries

1. **KYA never speaks SQL directly.** Every read and every write goes through `TpsClient`. This keeps RLS, audit attribution, and error mapping consistent with every other consumer.
2. **No bespoke business logic in the UI layer.** If the deny-overrides rule, risk scoring, or Sanna mapping needs to move, it moves in Layer 2 — the UI calls the new method.
3. **The audit log is read-only from KYA's perspective.** Operators can never edit history. Mistakes are corrected with new operations, which produce new audit entries.
4. **Authorization is the application's responsibility.** KYA verifies the operator's identity (SSO / OIDC) and maps the operator to a `tps.role` value before opening a `TpsClient` context. RLS does the rest.

---

## Surface map

### 1. Agent list (home view)

Columns: name, type, lifecycle state, owner, latest risk score, role count, review-overdue flag.

Filters: lifecycle state, agent type, product, owner. Search across name + purpose.

Source: `tps.agents.list()` + `tps.intelligence.risk` (for the badge) + `governance.agent_summary` view.

### 2. Agent detail

Tabs:

- **Identity** — purpose, version, owner, parent agent, last review.
- **Permissions** — net effective permissions table grouped by resource. Each row expandable to show grant lineage. From `intelligence.netEffectivePermissions(...)`.
- **Tools** — every tool the agent can use, with destructive flag and resource count. From `intelligence.toolInventory(...)`.
- **Blast radius** — graph view: agent → tools → resources, color-coded by sensitivity. From `intelligence.blastRadius(...)`.
- **SoD** — current violations from `intelligence.sodCheck(...)`. Each violation expandable to show side-A/side-B permission ids.
- **Risk** — latest score, factor breakdown, score history (read from `risk_assessments`).
- **Audit** — timeline of every event on this agent. From `tps.audit.forEntity('governance.agents', id)`.
- **Sanna export** — button: "Generate constitution" → calls `export.toSannaConstitution(...)`, shows the YAML and `policy_hash`, offers download + copy.

### 3. Resource detail

Per-resource view emphasizing exposure:

- Sensitivity, supported actions, data categories.
- Permission overlap — every agent with allow access (`intelligence.permissionOverlap(...)`).
- Governing rules — every active rule scoped to this resource, including critical halts.
- Coverage gap badge if it appears in `coverageGaps()`.

### 4. Rule explorer

- List view filtering by `rule_type`, `status`, `severity`, `scope`, condition type.
- Detail view: rule body, linked compliance requirements, last evaluation result + affected entities.
- Bulk evaluation runner — `rulesEngine.evaluate(...)` against the whole governance state, with per-result drill-down.

### 5. Compliance dashboard

For each compliance framework:

- Per-requirement status from `rulesEngine.complianceCheck(...)`.
- Drill into requirement → rules → most recent evaluation → affected entities.
- Export button — JSON or PDF report (PDF deferred; JSON in v1).

### 6. SoD violation queue

A workspace for triage. Reads `governance.sod_violations` view. Per row: agent, constraint, severity, side-A and side-B permissions. Actions: revoke an offending permission, suspend the agent, mark "accepted risk" with justification (writes a `risk_assessments` row with `assessment_method: 'manual'`).

### 7. Audit timeline

Global view across all entity types. Filters: actor, action_type, time window, correlation_id. Click an entity reference → jump to its detail view at that point in time using `auditReplay.reconstruct(...)`.

### 8. Topology canvas

Recursive agent hierarchy from `governance.agent_topology`. Force-directed graph; click a subtree to scope every other view.

### 9. Settings — operators and roles

Manage `agent_role_assignments` and inspect built-in roles. Built-in roles cannot be edited; custom roles can. RLS still applies — operators see only what their `tps.role` permits.

---

## Tech choices — open

The user should pick before implementation. Not yet decided.

### Option A — Web (recommended starting point)

- **Stack:** Next.js or Remix front end, React server components or a thin BFF route layer that wraps `TpsClient`. Tailwind + shadcn/ui for the dense data surfaces. ReactFlow or Cytoscape for the topology canvas.
- **Pros:** Familiar patterns; URL-shareable views; easy auth (NextAuth + OIDC provider); rich data viz library ecosystem; deployable to any container host.
- **Cons:** Heavier than a TUI for offline / SSH-only environments. The "terminal feel" called out in CLAUDE.md needs to be designed in (monospace fonts, tabular density, keyboard-first nav).

### Option B — TUI (terminal UI)

- **Stack:** Ink (React for the terminal) or Bubble Tea (Go). Calls into `TpsClient` over a thin RPC, or for the Go option a port of Layer 2.
- **Pros:** Matches the "terminal-like GUI" wording in CLAUDE.md literally; great for SSH-only / on-call workflows; tiny dependency footprint.
- **Cons:** Visualizations (blast radius graph, topology canvas) are awkward in a terminal; multi-window workflows need a tmux-aware layout; auth UX is less polished.

### Option C — Desktop app (Tauri)

- **Stack:** Tauri shell + the same web front end as Option A.
- **Pros:** Air-gapped governance environments get a native installable; shares 95% of code with Option A.
- **Cons:** Adds a release pipeline (per-OS binaries, code signing). Probably premature.

**Recommendation:** start with **Option A** with explicit attention to keyboard-first workflows and tabular density, and reuse the React front end inside Tauri later if needed.

---

## Read/write boundary

Every operator action maps to one `TpsClient` call:

| KYA action | TpsClient call |
|---|---|
| Approve an agent | `agents.setLifecycleState(ctx, id, 'approved')` |
| Revoke an assignment | `assignments.revoke(ctx, id)` |
| Add a permission | `permissions.create(ctx, ...)` |
| Activate a SoD constraint | `sodConstraints.setActive(ctx, id, true)` |
| Run a compliance check | `rulesEngine.complianceCheck(ctx, { framework })` |
| Score an agent | `intelligence.risk.scoreAndPersist(ctx, id)` |
| Export a constitution | `export.toSannaConstitution(ctx, id)` |
| Reconstruct past state | `intelligence.auditReplay.agentAccessAsOf(ctx, id, t)` |

If KYA needs a thing the engine doesn't expose, the change goes into Layer 2 — never around it.

---

## Cross-cutting concerns

### Identity and `tps.role` mapping

KYA needs an authentication provider (OIDC works). On every request the BFF resolves operator → `tps.role`. The mapping table lives outside TPS — likely in the deployment's identity system. Default mapping for self-hosted deployments:

- IdP group `tps-system-admin` → `system_admin`
- IdP group `tps-governance-admin` → `governance_admin`
- IdP group `tps-agent-operator` → `agent_operator`
- IdP group `tps-auditor` → `auditor`
- everyone else → `read_only_observer`

### Long-running operations

`scoreAndPersist`, `permissionOverlap`, full-graph rule evaluation, and constitution export can each take seconds. KYA should:

- Run these out of the request thread (job queue, websocket-pushed status, or polling).
- Show progress and the partial result.
- Cache where staleness is acceptable (graph topology, blast radius). Cache invalidation listens to the audit log — every mutation produces an entry, so a `LISTEN/NOTIFY` channel on `audit_log` insertions can drive cache invalidation.

### Real-time updates

Phase 2. Initial release polls. Phase 2 adds postgres `LISTEN/NOTIFY` (postgres.js supports this natively) on the audit log, fanning out to connected clients via SSE or websockets.

### Error surfaces

KYA renders `TpsError` codes verbatim — `TPS_NOT_FOUND`, `TPS_CONFLICT`, `TPS_DEPENDENCY`, `TPS_PERMISSION`, `TPS_VALIDATION`, `TPS_RULE_VIOLATION`. Each needs a friendly translation per locale. Default message stays in the network response so operators searching the audit log can correlate.

---

## Out of scope for v1

- **Cryptographic signing** of exported constitutions — Sanna's job; KYA shows the policy hash and offers a "send to signing service" button that POSTs to a configurable webhook.
- **Multi-tenant / multi-org** — D005 is "single-tenant Layer 1." KYA inherits this; deploy one KYA per database.
- **Editing audit history** — append-only by D008; KYA never offers this.
- **Custom dashboards / saved views** — phase 2 if requested by operators.
- **Mobile responsive layout** — desktop / tablet only; the data density doesn't fit well on phones and the use case is governance review at a real workstation.

---

## Open questions for the user

Before this becomes a CLAUDE.md:

1. Web (Option A), TUI (Option B), or both?
2. Hosted SaaS or operator-self-hosted? (Affects auth, deployment, and the multi-tenant question.)
3. Do we ship a starter Sanna webhook integration, or leave that as documentation?
4. Real-time (LISTEN/NOTIFY + push) on day one, or polling?
5. What's the smallest demoable surface — agent detail + blast radius + SoD queue is one candidate. Or is the topology canvas the headline?
6. Charting library preference if Option A — Recharts vs. Visx vs. D3-native?

---

## Recommended first milestone

If Option A is chosen: ship the **agent detail tab** end-to-end. Identity, permissions, tools, blast radius, audit timeline, Sanna export. That single screen exercises six of the eight major engine APIs and proves the read/write boundary. Once that lands, the other surfaces are mostly more of the same shape.
