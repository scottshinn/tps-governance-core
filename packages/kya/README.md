# @tpsdev/kya

TPS KYA — **Know Your Agent**. Visual governance control plane for AI agent deployments.

Layer 3 of the TPS architecture:

- Layer 1 — `@tpsdev/governance-core` — PostgreSQL schema
- Layer 2 — `@tpsdev/governance-engine` — typed client + intelligence library
- Layer 3 — `@tpsdev/kya` — this package, the operator UI

KYA reads and mutates governance state **only** through `TpsClient` from `@tpsdev/governance-engine`. No direct SQL, no parallel data layer.

## Stack

- Next.js 15 (App Router) + React 19
- Tailwind CSS 4 (CSS-first config in `app/globals.css` `@theme` block)
- `@tpsdev/governance-engine` (workspace dep)
- `@tanstack/react-table` for dense tables
- Lucide React icons, date-fns

## Run

```sh
cp .env.example .env
# point env vars at a Postgres where @tpsdev/governance-core is deployed
pnpm dev
```

The app starts on `http://localhost:3000` and redirects to `/agents`.

## Phase 1 status

Scaffold:

- [x] Next.js 15 / Tailwind 4 / React 19 wired up
- [x] Terminal design tokens in `app/globals.css` (`@theme` block)
- [x] `lib/tps.ts` server-side `TpsClient` singleton
- [x] Root layout with sidebar shell
- [x] `/agents` placeholder showing live data via the engine
- [ ] Component library (StatusBadge, SeverityBadge, RiskScore, DataTable, FilterBar, CommandPalette, EntityLink, JsonDiff, YamlPreview, SensitivityBar, ComplianceProgress, AuditEvent, KyaCard, Breadcrumb, EmptyState, ConfirmDialog)
- [ ] Agent registry — full DataTable + FilterBar + cursor pagination
- [ ] KYA Card — agent detail (`/agents/[id]`)
- [ ] Agent sub-pages — permissions, tools, blast-radius, audit
- [ ] Audit timeline — `/audit` with grouped-by-day rendering
- [ ] Server Actions for mutations (approve, suspend, export constitution, evaluate rules)
- [ ] Loading skeletons matching the terminal aesthetic
- [ ] Keyboard nav (table arrows, ⌘K, /, Enter, Esc)
