# CLAUDE.md — TPS KYA (Layer 3)

## Project Identity

**Name:** `@tpsdev/kya`
**Full Name:** TPS KYA — Know Your Agent
**Type:** Next.js application — the visual governance control plane for AI agent deployments
**License:** MIT
**Author:** Scott Shinn
**npm Scope:** @tpsdev

## What This Is

TPS KYA is the operator interface for the TPS governance platform. It is a browser-based application styled with a terminal-inspired, information-dense aesthetic. Operators use KYA to see every agent in their deployment, understand what each agent can do, identify governance gaps and violations, review audit history, and explore the full I/O surface of their AI agent infrastructure.

KYA is Layer 3 of the TPS architecture:
- **Layer 1 — `@tpsdev/governance-core`:** PostgreSQL schema (deployed, tested)
- **Layer 2 — `@tpsdev/governance-engine`:** TypeScript governance intelligence library (built, unit tests passing)
- **Layer 3 — `@tpsdev/kya` (this application):** Visual control plane

KYA has one absolute rule: **every data read and every mutation goes through `TpsClient` from `@tpsdev/governance-engine`.** KYA never touches SQL directly. The engine is the only interface to the database.

## Required Context

Read the Layer 2 documentation before building:

1. **Layer 2 `docs/API.md`** — every public method on `TpsClient`, input types, return types
2. **Layer 2 `docs/RULE-CONDITIONS.md`** — the rule condition types and their JSON schemas
3. **Layer 2 `docs/SANNA-EXPORT.md`** — the Sanna constitution export mapping
4. **Layer 1 `docs/ARCHITECTURE.md`** — the entity relationship model and design principles
5. **Layer 1 `docs/DATA-MODEL-REFERENCE.md`** — every table, column, enum, function, view

If any of these docs are not present, ask the user before proceeding.

## Tech Stack

```json
{
  "framework": "Next.js 15 (App Router)",
  "react": "React 19",
  "styling": "Tailwind CSS 4",
  "components": "shadcn/ui (customized to terminal theme)",
  "state": "React Server Components for data fetching, client components for interactivity",
  "database": "@tpsdev/governance-engine (TpsClient)",
  "charts": "Recharts (for dashboard metrics)",
  "graphs": "React Flow (for topology view)",
  "tables": "@tanstack/react-table (for agent registry, audit log, resource explorer)",
  "icons": "Lucide React",
  "dates": "date-fns",
  "yaml": "yaml (for Sanna export preview)",
  "testing": "Vitest + React Testing Library + Playwright (e2e)"
}
```

**No additional backend or API layer.** Next.js Server Components and Server Actions call `TpsClient` directly. The TPS client is instantiated in a server-side singleton and reused across requests.

## Design System — Terminal-Inspired Governance UI

### Philosophy

KYA should feel like a **mission control terminal** — not a consumer SaaS dashboard. The target audience is security engineers, governance operators, and compliance teams. They value information density, keyboard navigation, and zero ambiguity over visual polish or whitespace. Think Bloomberg Terminal meets Linear meets htop.

### Visual Identity

**Color palette:**

```css
:root {
  /* Backgrounds */
  --kya-bg-primary: #0a0a0f;        /* Near-black, slight blue undertone */
  --kya-bg-secondary: #12121a;      /* Panels, cards */
  --kya-bg-tertiary: #1a1a25;       /* Elevated surfaces, hover states */
  --kya-bg-surface: #22222f;        /* Input fields, table rows on hover */

  /* Text */
  --kya-text-primary: #e0e0e8;      /* Primary content */
  --kya-text-secondary: #8888a0;    /* Labels, descriptions, metadata */
  --kya-text-muted: #555568;        /* Disabled, timestamps */

  /* Accent — green phosphor terminal feel */
  --kya-accent-primary: #00ff88;    /* Primary actions, active states */
  --kya-accent-secondary: #00cc6a;  /* Hover on primary accent */
  --kya-accent-dim: #00ff8822;      /* Accent backgrounds, glows */

  /* Status / Severity */
  --kya-status-critical: #ff3344;   /* Critical risk, SoD violations, deny */
  --kya-status-high: #ff8800;       /* High risk, warnings */
  --kya-status-medium: #ffcc00;     /* Medium risk, review overdue */
  --kya-status-low: #00cc6a;        /* Low risk, healthy */
  --kya-status-info: #4488ff;       /* Informational, neutral */

  /* Lifecycle states */
  --kya-state-proposed: #8888a0;
  --kya-state-under-review: #ffcc00;
  --kya-state-approved: #4488ff;
  --kya-state-active: #00ff88;
  --kya-state-suspended: #ff8800;
  --kya-state-decommissioned: #555568;

  /* Borders */
  --kya-border-default: #2a2a38;
  --kya-border-focus: #00ff88;
}
```

**Typography:**

```css
:root {
  --kya-font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
  --kya-font-sans: 'Inter', -apple-system, sans-serif;
  
  --kya-text-xs: 0.6875rem;    /* 11px — timestamps, IDs */
  --kya-text-sm: 0.75rem;      /* 12px — table cells, metadata */
  --kya-text-base: 0.8125rem;  /* 13px — body text */
  --kya-text-lg: 0.9375rem;    /* 15px — section headers */
  --kya-text-xl: 1.125rem;     /* 18px — page titles */
}
```

All data content (names, values, IDs, code) uses the monospace font. Labels and descriptions use sans-serif. This creates a clear visual hierarchy between "data" and "chrome."

**Layout principles:**
- **No whitespace waste.** Every pixel carries information or breathing room, not filler.
- **Dense by default.** Tables show 20+ rows without scrolling. Cards pack multiple data points into compact layouts.
- **Grid-based.** The main layout is a sidebar + content area. The content area uses CSS Grid for multi-panel layouts.
- **Dark everywhere.** No light mode. This is an ops tool.
- **Keyboard first.** Every action reachable via keyboard. `⌘K` command palette for global navigation. Arrow keys for table navigation. `Enter` to drill into an entity. `Esc` to go back.

**Component styling overrides for shadcn/ui:**
- Buttons: small, compact, monospace labels, accent green for primary actions, ghost style for secondary
- Tables: no alternating row colors; subtle border between rows; hover highlights entire row with `--kya-bg-tertiary`
- Badges/pills: small, uppercase monospace, colored by status/severity
- Cards: no rounded corners (or very slight, 2px max); thin border; no shadow
- Inputs: monospace, dark background, accent border on focus
- Dialogs: centered, dark, no backdrop blur (blur is consumer UI energy)
- Tooltips: fast (100ms delay), monospace, dark

### Iconography

Use Lucide icons throughout. Size: 14px–16px. Color: `--kya-text-secondary` by default, `--kya-accent-primary` for active/interactive elements.

### Motion

Minimal. No page transitions, no slide-in panels, no bouncing. Only:
- Instant opacity transitions on hover (100ms)
- Height transitions on expand/collapse (150ms, ease-out)
- Loading skeletons (pulse animation) for data fetching states

---

## Application Structure

```
app/
├── layout.tsx                    # Root layout: sidebar + main content area
├── page.tsx                      # Redirect to /agents
│
├── agents/
│   ├── page.tsx                  # Agent Registry (table view)
│   └── [id]/
│       ├── page.tsx              # KYA Card — agent detail
│       ├── permissions/
│       │   └── page.tsx          # Net effective permissions detail
│       ├── tools/
│       │   └── page.tsx          # Tool inventory detail
│       ├── blast-radius/
│       │   └── page.tsx          # Blast radius visualization
│       └── audit/
│           └── page.tsx          # Audit timeline filtered to this agent
│
├── audit/
│   └── page.tsx                  # Global audit timeline
│
├── topology/
│   └── page.tsx                  # Agent hierarchy graph (Phase 2)
│
├── dashboard/
│   └── page.tsx                  # Governance dashboard (Phase 3)
│
├── resources/
│   └── page.tsx                  # Resource explorer (Phase 2)
│
├── rules/
│   └── page.tsx                  # Rule management (Phase 2)
│
├── compliance/
│   └── page.tsx                  # Compliance reports (Phase 3)
│
└── api/
    └── tps/
        └── route.ts              # Optional: thin API route for client-side fetches
```

---

## Build Phases

### Phase 1 — Core Agent Views + Audit Timeline (BUILD THIS FIRST)

This is the minimum viable KYA. An operator can see all agents, drill into any agent, understand its full permission and tool profile, and review the audit history.

#### 1A: Application Shell

**Root Layout (`app/layout.tsx`)**

The layout is a fixed sidebar + scrollable content area:

```
┌──────────────────────────────────────────────────────┐
│  TPS                                          ⌘K    │
├────────┬─────────────────────────────────────────────┤
│        │                                             │
│ AGENTS │  [content area]                             │
│ AUDIT  │                                             │
│        │                                             │
│ ────── │                                             │
│        │                                             │
│ TOPO   │                                             │
│ RULES  │                                             │
│ DASH   │                                             │
│ COMPLY │                                             │
│        │                                             │
│ ────── │                                             │
│        │                                             │
│ v0.1.0 │                                             │
│        │                                             │
└────────┴─────────────────────────────────────────────┘
```

Sidebar: fixed width (200px), monospace labels, icons from Lucide. Active page highlighted with accent. Phase 2/3 items shown but dimmed/disabled with "(soon)" label. Bottom: version number and connection status indicator (green dot = connected to DB, red = disconnected).

**Command Palette (`⌘K`)**

A modal search/command palette (use shadcn/ui `CommandDialog` or build from `cmdk`). Supports:
- Jump to any agent by name: type "payment" → shows "payment-processor" agent
- Jump to any page: "audit", "topology", "dashboard"
- Quick actions: "new agent", "new rule", "export constitution"
- Search across agents, resources, tools, rules by name

**TPS Client singleton:**

```typescript
// lib/tps.ts
import { TpsClient } from '@tpsdev/governance-engine';

let client: TpsClient | null = null;

export function getTpsClient(): TpsClient {
  if (!client) {
    client = new TpsClient({
      connection: {
        host: process.env.TPS_DB_HOST!,
        port: Number(process.env.TPS_DB_PORT!),
        database: process.env.TPS_DB_NAME!,
        username: process.env.TPS_DB_USER!,
        password: process.env.TPS_DB_PASSWORD!,
      },
    });
  }
  return client;
}

// Default context for server-side operations
// In production, this would come from the authenticated user's session
export function getDefaultContext(): TpsContext {
  return {
    actor: process.env.TPS_DEFAULT_ACTOR || 'kya-system',
    role: (process.env.TPS_DEFAULT_ROLE || 'governance_admin') as TpsRole,
  };
}
```

#### 1B: Agent Registry (`/agents`)

**The home screen.** A full-width table of all agents in the system.

**Columns:**
| Column | Source | Display |
|---|---|---|
| Status | `lifecycle_state` | Colored dot + label |
| Name | `name` | Monospace, clickable → `/agents/[id]` |
| Type | `agent_type` | Badge (orchestrator, worker, autonomous, HITL) |
| Product | `product.name` | Text, dimmed if null |
| Parent | `parent_agent.name` | Text, dimmed if top-level |
| Roles | count of active assignments | Number |
| Risk | latest `risk_assessment.risk_level` | Colored badge (critical=red, high=orange, etc.) |
| Review | `last_review_at` + `review_cycle_days` | "OK" (green) or "Overdue" (yellow) or "No cycle" (dimmed) |
| Created | `created_at` | Relative time ("3d ago") |

**Features:**
- **Filter bar** at the top: lifecycle state (multi-select chips), agent type, product, risk level, review status
- **Search**: real-time filter on name and purpose
- **Sort**: click column headers to sort (default: risk desc, then name asc)
- **Pagination**: cursor-based, 50 rows per page, "Load more" button (no page numbers)
- **Keyboard**: arrow keys to navigate rows, Enter to open agent detail, `/` to focus search
- **Bulk count**: "Showing 47 agents" badge in the filter bar

**Data fetching:**
Server Component. Call `tps.agents.list(ctx, { limit: 50, ...filters })` in the page component. Filters come from URL search params so the page is shareable/bookmarkable.

#### 1C: KYA Card — Agent Detail (`/agents/[id]`)

**The core of the product.** When you click an agent, you see everything about it.

**Layout: a two-column grid with stacked sections:**

```
┌──────────────────────────────────────────────────────┐
│  ← Back to Agents          payment-processor    ●ACT │
├──────────────────────────────┬───────────────────────┤
│                              │                       │
│  IDENTITY                    │  RISK                 │
│  Name: payment-processor     │  Score: 4 (HIGH)      │
│  Type: worker                │  ┌─────────────────┐  │
│  Purpose: Process customer   │  │ pii_data_access  │  │
│    payments via Stripe       │  │ destructive_tool │  │
│  Owner: payments-team        │  │ sod_violation    │  │
│  Product: payments           │  └─────────────────┘  │
│  State: active               │                       │
│  Review: 12d ago (OK)        │  SOD VIOLATIONS       │
│                              │  ⚠ Initiate-Approve   │
│  HIERARCHY                   │    Separation          │
│  Reports to: orchestrator-1  │                       │
│  Sub-agents: none            │                       │
│                              │                       │
├──────────────────────────────┴───────────────────────┤
│                                                      │
│  TOOLS (6)                                    → View │
│  ┌────────────────────┬──────┬────────┬───────────┐  │
│  │ Name               │ Type │ Server │ Destruct? │  │
│  ├────────────────────┼──────┼────────┼───────────┤  │
│  │ stripe_charge      │ MCP  │ stripe │ No        │  │
│  │ stripe_refund      │ MCP  │ stripe │ Yes  ●    │  │
│  │ db_read_customers  │ DB   │ —      │ No        │  │
│  │ db_write_orders    │ DB   │ —      │ No        │  │
│  │ email_send         │ API  │ —      │ No        │  │
│  │ file_upload_receipt│ File │ —      │ No        │  │
│  └────────────────────┴──────┴────────┴───────────┘  │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  NET PERMISSIONS (14)                         → View │
│  ┌──────────────────┬──────────┬────────┬─────────┐  │
│  │ Resource          │ Actions  │ Grant  │ Via     │  │
│  ├──────────────────┼──────────┼────────┼─────────┤  │
│  │ customers_table   │ read     │ ALLOW  │ reader  │  │
│  │ orders_table      │ read,wrt │ ALLOW  │ writer  │  │
│  │ pii_columns       │ read     │ DENY ● │ sec-pol │  │
│  │ stripe_api        │ execute  │ ALLOW  │ stripe  │  │
│  └──────────────────┴──────────┴────────┴─────────┘  │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  BLAST RADIUS (8 resources)                   → View │
│  ■■■■■□□ critical(0) restricted(1) confid(2)         │
│          internal(3) public(2)                       │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  COMPLIANCE                                          │
│  GDPR: 4/5 met  EU AI Act: 3/5 met  SOC2: 5/5 met  │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  RECENT AUDIT (last 10)                       → All  │
│  27 Apr 14:32  alice@  permission_granted  orders    │
│  27 Apr 14:30  alice@  role_assigned       writer    │
│  27 Apr 13:15  system  agent_approved      —         │
│  ...                                                 │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Data fetching for this page (all via TpsClient):**

```typescript
// app/agents/[id]/page.tsx — Server Component
const tps = getTpsClient();
const ctx = getDefaultContext();

const [
  agent,
  netPerms,
  tools,
  blastRadius,
  sodViolations,
  riskAssessment,
  recentAudit,
  compliance,
] = await Promise.all([
  tps.agents.get(ctx, params.id),
  tps.intelligence.netEffectivePermissions(ctx, params.id),
  tps.intelligence.toolInventory(ctx, params.id),
  tps.intelligence.blastRadius(ctx, params.id),
  tps.intelligence.sodCheck(ctx, params.id),
  tps.riskAssessments.latest(ctx, { entity_type: 'governance.agents', entity_id: params.id }),
  tps.audit.list(ctx, { entity_type: 'governance.agents', entity_id: params.id, limit: 10 }),
  tps.rules.complianceCheck(ctx, { agentId: params.id }),
]);
```

All eight calls run in parallel via `Promise.all`. Each section of the KYA Card renders from one of these results.

**Sections detail:**

**Identity panel:** Static display of agent fields. Lifecycle state shown as a colored badge. Review status computed from `last_review_at` + `review_cycle_days` vs. now. Link to edit (opens a modal form with `tps.agents.update`).

**Risk panel:** The latest risk assessment. Risk score as a large colored number. Below it, a list of contributing risk factors (from `risk_factors` jsonb). Each factor is a row with the factor name and its weight.

**SoD Violations panel:** Only shown if violations exist. Each violation shows the constraint name, severity badge, and the conflicting permission names. Click to see full detail.

**Tools table:** First 6 rows from `agent_tool_inventory`. Shows tool name, type badge, MCP server name (or "—"), destructive flag (red dot if true). "→ View" link goes to `/agents/[id]/tools` for the full list.

**Net Permissions table:** First 8 rows from `netEffectivePermissions`. Shows resource name, net actions as comma-separated badges, grant type (ALLOW in green, DENY in red), and the granting role name. "→ View" link goes to `/agents/[id]/permissions` for the full list with lineage detail.

**Blast Radius summary:** A compact horizontal bar showing resource counts by sensitivity classification. Each segment is colored by sensitivity (critical=red, restricted=orange, confidential=yellow, internal=blue, public=gray). Shows total resource count. "→ View" link goes to `/agents/[id]/blast-radius` for the full list.

**Compliance summary:** One-line-per-framework showing "X/Y met" with a progress indicator. Only shows frameworks that have rules linked to this agent or its product.

**Recent Audit:** Last 10 audit events for this agent. Each row: timestamp (relative), actor, action type, affected entity. "→ All" link goes to `/agents/[id]/audit`.

**Actions bar (top right of KYA Card):**
- "Export Constitution" button → calls `tps.export.toSannaConstitution(ctx, id)`, shows YAML in a modal with copy-to-clipboard
- "Run Risk Assessment" button → calls `tps.intelligence.computeRiskScore(ctx, id)`, refreshes the risk panel
- "Evaluate Rules" button → calls `tps.rules.evaluate(ctx, id)`, shows results in a modal
- Lifecycle state transition buttons: contextual based on current state (e.g., "Approve" if `under_review`, "Suspend" if `active`)

#### 1D: Agent Sub-Pages

**`/agents/[id]/permissions`** — Full net effective permissions table with all columns from `NetPermission` type. Shows the grant lineage (which role at which depth granted or denied each action). Filterable by resource type, sensitivity, grant type. Expandable rows that show the individual permission records that composed into the net result.

**`/agents/[id]/tools`** — Full tool inventory table with all columns from `agent_tool_inventory`. Shows resource count per tool, effective actions per tool, MCP server details. Expandable rows showing the resources each tool accesses (from `tool_resources`).

**`/agents/[id]/blast-radius`** — Full blast radius table sorted by sensitivity descending. Shows every resource the agent can reach, how it reaches it (direct permission vs. via tool), and the effective actions. Color-coded rows by sensitivity. This is the "if this agent is compromised, here's the damage" view.

**`/agents/[id]/audit`** — Filtered audit timeline showing only events for this agent and its related entities (permissions, assignments, roles). Same component as the global audit timeline but pre-filtered.

#### 1E: Audit Timeline (`/audit`)

**A searchable, filterable, real-time log of every governance event.**

**Layout:**

```
┌──────────────────────────────────────────────────────┐
│  Audit Timeline                                      │
├──────────────────────────────────────────────────────┤
│  Filters: [Entity Type ▾] [Action Type ▾] [Actor ▾] │
│           [Date Range: _____ to _____]  [Search___]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  TODAY                                               │
│  14:32:01  alice@example.com                         │
│  permission_granted on governance.permissions        │
│  Entity: perm-uuid-1234                              │
│  + { role_id: "...", resource_id: "...",             │
│      actions: ["read", "write"], grant_type: "allow" │ 
│    }                                                 │
│  ────────────────────────────────────────────────     │
│  14:30:45  alice@example.com                         │
│  role_assigned on governance.agent_role_assignments   │
│  Entity: assign-uuid-5678                            │
│  + { agent_id: "...", role_id: "...",                │
│      status: "active" }                              │
│  ────────────────────────────────────────────────     │
│  13:15:22  system                                    │
│  agent_approved on governance.agents                 │
│  Entity: agent-uuid-9012                             │
│  Δ lifecycle_state: "under_review" → "approved"      │
│                                                      │
│  YESTERDAY                                           │
│  ...                                                 │
│                                                      │
│  [Load more]                                         │
└──────────────────────────────────────────────────────┘
```

**Features:**

- **Grouped by day** with date headers
- **Each event shows:** timestamp (HH:MM:SS), actor, action type (as a colored badge), entity type, entity ID (truncated, click to copy full UUID)
- **State diff:** For UPDATE events, show the changed fields as `field: old → new` (compare `previous_state` and `new_state` JSON). For INSERT, show `+ new_state`. For DELETE, show `- previous_state`.
- **Expand/collapse:** Events are collapsed by default (one line per event). Click to expand and see the full state diff.
- **Filters:** Entity type dropdown (agents, permissions, roles, etc.), action type dropdown (from `audit_action_type` enum), actor text search, date range picker
- **Search:** Free-text search across actor, entity type, and reason fields
- **Point-in-time:** A "Reconstruct at..." button that opens a date/time picker. Selecting a timestamp calls `tps.audit.reconstructState(ctx, { entity_type, entity_id, as_of })` and shows the reconstructed state in a modal.
- **Pagination:** Cursor-based, 50 events per page, "Load more" at bottom
- **URL params:** All filters encoded in URL search params for shareability

**Data fetching:**

```typescript
// Server Component with URL search params
const events = await tps.audit.list(ctx, {
  entity_type: searchParams.entity_type,
  action_type: searchParams.action_type,
  actor: searchParams.actor,
  from: searchParams.from ? new Date(searchParams.from) : undefined,
  to: searchParams.to ? new Date(searchParams.to) : undefined,
  limit: 50,
  cursor: searchParams.cursor,
});
```

---

### Phase 2 — Topology View + Resource Explorer + Rule Management

**Build after Phase 1 is stable and tested.**

#### Topology View (`/topology`)

Uses **React Flow** to render the agent hierarchy as an interactive directed graph.

- Nodes: agents, styled by lifecycle state and risk level
- Edges: parent → child relationships (from `parent_agent_id`)
- Node content: agent name, type icon, risk score badge, tool count
- Click node → navigate to `/agents/[id]`
- Filter by product (show only agents in one product)
- Layout algorithm: hierarchical top-to-bottom (Dagre or ELK)
- Mini-map in corner for large hierarchies
- Data: `tps.agents.list(ctx, {})` + build adjacency from `parent_agent_id`; enrich with `agent_summary` view data

#### Resource Explorer (`/resources`)

A table of all resources with governance metadata:
- Columns: name, type, sensitivity, data categories, active agent count, has_delete_grant, has_admin_grant
- Click a resource → side panel showing `permission_overlap` results (which agents can access it)
- Filter by resource type, sensitivity, data category, product
- "Ungoverned" filter toggle → shows only resources from `coverage_gaps()`
- Data: `tps.resources.list(ctx, filters)` + `resource_exposure` view

#### Rule Management (`/rules`)

A table of all governance rules with status, type, severity, scope, linked compliance requirements.
- Create new rule: form that builds the JSON condition (with a dropdown for condition type and dynamic fields per type from `RULE-CONDITIONS.md`)
- Enable/disable rules: toggle with confirmation
- Evaluate rules: "Run" button per rule that calls the evaluator and shows pass/fail
- Link rules to compliance requirements
- Data: `tps.rules.list(ctx)` + CRUD operations

---

### Phase 3 — Governance Dashboard + Compliance Reports

**Build after Phase 2.**

#### Governance Dashboard (`/dashboard`)

A single-screen overview with metric panels:

- **SoD Violations:** count badge + list from `sod_violations` view. Click → drills to the agent with the violation.
- **Ungoverned Resources:** count + list from `coverage_gaps()`. Click → drills to the resource.
- **Risk Distribution:** horizontal bar chart showing agent count per risk level (negligible through critical).
- **Review Status:** count of agents overdue for review vs. on schedule.
- **Compliance Coverage:** one row per framework showing "X/Y requirements met" with a progress bar.
- **Recent Activity:** last 5 audit events (compact, same component as audit timeline but minimal).

All data from `TpsClient` intelligence methods + views.

#### Compliance Reports (`/compliance`)

- Select a framework → run `tps.rules.complianceCheck(ctx, { framework })` → show structured report
- Per-requirement breakdown: requirement reference code, description, linked rules, evaluation results
- Export as markdown or PDF (stretch goal)

---

## Server-Side Patterns

### TPS Client Context from Session

In Phase 1, use a hardcoded default context (from env vars). This is acceptable for a single-operator tool. For multi-user deployments (Phase 3+), the context should come from the authenticated user's session:

```typescript
// Future pattern — when auth is added
import { auth } from '@/lib/auth';

async function getTpsContext(): Promise<TpsContext> {
  const session = await auth();
  return {
    actor: session.user.email,
    role: session.user.tpsRole, // mapped from your auth system's roles
  };
}
```

### Server Actions for Mutations

All write operations use Next.js Server Actions:

```typescript
// app/agents/[id]/actions.ts
'use server';

import { getTpsClient, getDefaultContext } from '@/lib/tps';
import { revalidatePath } from 'next/cache';

export async function approveAgent(agentId: string) {
  const tps = getTpsClient();
  const ctx = getDefaultContext();
  
  await tps.agents.update(ctx, agentId, { 
    lifecycle_state: 'approved' 
  });
  
  revalidatePath(`/agents/${agentId}`);
  revalidatePath('/agents');
}

export async function exportConstitution(agentId: string) {
  const tps = getTpsClient();
  const ctx = getDefaultContext();
  
  return tps.export.toSannaConstitution(ctx, agentId);
}
```

### Loading States

Use React Suspense boundaries with skeleton components:

```typescript
// app/agents/[id]/page.tsx
import { Suspense } from 'react';
import { AgentDetailSkeleton } from '@/components/skeletons';

export default function AgentPage({ params }) {
  return (
    <Suspense fallback={<AgentDetailSkeleton />}>
      <AgentDetail id={params.id} />
    </Suspense>
  );
}
```

Skeleton components should match the terminal aesthetic — pulsing `--kya-bg-tertiary` blocks in the shape of the actual content.

---

## Component Library

Build these reusable components (all using the terminal design system):

| Component | Purpose |
|---|---|
| `StatusBadge` | Lifecycle state indicator (colored dot + label) |
| `SeverityBadge` | Risk/severity level badge (colored, uppercase) |
| `RiskScore` | Large risk score display with color and contributing factors |
| `DataTable` | Wrapper around @tanstack/react-table with terminal styling |
| `FilterBar` | Horizontal filter controls with chips, dropdowns, search |
| `CommandPalette` | ⌘K global search/navigation |
| `EntityLink` | Clickable link to an entity (agent, resource, tool, etc.) |
| `JsonDiff` | Side-by-side or inline diff of two JSON objects (for audit events) |
| `YamlPreview` | Syntax-highlighted YAML display (for Sanna export) |
| `SensitivityBar` | Horizontal stacked bar showing resource counts by sensitivity |
| `ComplianceProgress` | Framework compliance progress (X/Y met) |
| `AuditEvent` | Single audit log entry (expandable) |
| `KyaCard` | Generic card component with terminal styling |
| `Breadcrumb` | Navigation breadcrumb (Agents > payment-processor > Permissions) |
| `EmptyState` | "No data" display with icon and action suggestion |
| `ConfirmDialog` | Confirmation dialog for destructive actions |

---

## Environment Variables

```env
# Database connection (same Postgres where governance-core is deployed)
TPS_DB_HOST=localhost
TPS_DB_PORT=5432
TPS_DB_NAME=governance_dev
TPS_DB_USER=postgres
TPS_DB_PASSWORD=postgres

# Default context (Phase 1 — no auth)
TPS_DEFAULT_ACTOR=kya-operator
TPS_DEFAULT_ROLE=governance_admin
```

---

## What NOT to Build (Yet)

- No user authentication / login — Phase 1 is single-operator, context from env vars
- No multi-tenant organization switching
- No real-time WebSocket updates (audit events appear on page refresh or navigation)
- No PDF export of compliance reports
- No Sanna receipt ingestion or display
- No agent creation wizard — use simple form modals for now
- No permission recommendation engine (AI-assisted rule creation is a future product feature)
- No mobile responsive design — this is a desktop ops tool

---

## Build Status

### Phase 1 — To Build
- [ ] Design system: Tailwind config with terminal theme CSS variables
- [ ] Component library: all 16 components listed above
- [ ] Application shell: root layout, sidebar, command palette
- [ ] Agent Registry page (`/agents`)
- [ ] KYA Card — Agent Detail page (`/agents/[id]`)
- [ ] Agent sub-pages: permissions, tools, blast-radius, audit
- [ ] Audit Timeline page (`/audit`)
- [ ] TPS Client singleton (`lib/tps.ts`)
- [ ] Server Actions for mutations
- [ ] Loading skeletons for all pages
- [ ] Keyboard navigation (table arrows, ⌘K, /, Enter, Esc)
- [ ] Error boundaries and error states

### Phase 2 — After Phase 1
- [ ] Topology View (`/topology`) with React Flow
- [ ] Resource Explorer (`/resources`)
- [ ] Rule Management (`/rules`)

### Phase 3 — After Phase 2
- [ ] Governance Dashboard (`/dashboard`)
- [ ] Compliance Reports (`/compliance`)

### Documentation — Generate at Session End
- Update this CLAUDE.md build status
- Create `docs/COMPONENTS.md` — component API reference
- Create `docs/DESIGN-SYSTEM.md` — color, typography, spacing reference
