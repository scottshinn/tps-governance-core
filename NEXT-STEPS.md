# Next steps — TPS

Status as of 2026-04-27:

- **Layer 1 — `@tpsdev/governance-core`** — pgpm Postgres module. Schema, indexes, six intelligence functions, audit triggers, RLS policies, seed data, 12 test files. `pgpm deploy` validation pending against a live database.
- **Layer 2 — `@tpsdev/governance-engine`** — TypeScript library. Full scaffold complete: 13 CRUD modules, 8 intelligence modules, 8 rule evaluators, Sanna v1.4 exporter. `tsc` clean, 26 / 26 unit tests passing. **Integration tests against a live database are pending.**
- **Layer 3 — TPS KYA** — not started.

This document indexes the per-track plans for what's next.

---

## Track 1 — Ship Layer 2

[`docs/LAYER-2-VALIDATION.md`](./docs/LAYER-2-VALIDATION.md) — concrete plan for:

1. Standing up a test database with `governance-core` deployed
2. Adding pgsql-test integration tests for every CRUD module
3. Round-trip tests for the six intelligence functions (DB output ↔ TS resolver output)
4. Tests for all eight rule evaluators against fixtures
5. End-to-end Sanna export test
6. `pnpm publish --dry-run` and tarball inspection

Blocker for: any consumer that wants a tagged `@tpsdev/governance-engine@0.1.0` from npm.

---

## Track 2 — Validate Layer 1 against a live database

Layer 1 has `pgpm deploy/verify/revert` SQL written but never executed. From `CLAUDE.md`'s pending list:

- [ ] `pgpm deploy --createdb --database governance_dev`
- [ ] `pgpm verify --database governance_dev` — all 42 verify scripts pass
- [ ] `pnpm test` — all 12 test suites pass against the deployed schema
- [ ] `pgpm revert --database governance_dev` — clean revert succeeds

This unblocks Track 1: Layer 2 integration tests run against the same deployed schema.

---

## Track 3 — Begin Layer 3 (TPS KYA)

[`docs/LAYER-3-KYA-SPEC.md`](./docs/LAYER-3-KYA-SPEC.md) — preliminary spec for the visual "Know Your Agent" control plane.

Sections:

- What KYA is for: a terminal-feeling GUI for governance operators showing every agent, its topology, its permissions, and its full I/O surface
- Surface map (agent list, agent detail, blast radius graph, SoD violation queue, compliance report, audit timeline)
- Tech choices (TUI vs. browser, framework candidates)
- Read/write boundary — KYA mutates only through `TpsClient`; never touches SQL directly
- What gets deferred to a later milestone (cryptographic signing, real-time push, multi-tenant deployments)

This is a proposal, not a commitment — the user should redirect before implementation starts.

---

## Track 4 (parallel, optional) — Python SDK

`@tpsdev/governance-engine` is the reference Layer 2 SDK. CLAUDE.md notes a Python sibling on PyPI (`tpsdev`) is planned. Specific deliverables:

- `packages/governance-engine-py/` (or a separate repo `tpsdev-py`)
- Mirrors the TypeScript surface: `TpsClient`, CRUD, intelligence, rules, export
- Reuses the database functions for `effective_permissions`, `sod_check`, `blast_radius`, `permission_overlap`, `coverage_gaps`, `agent_tool_inventory` — only the resolver/scorer/evaluators need re-implementation
- Cross-language conformance tests: same fixtures, same outputs

A spec document for this track is **not** included yet — start when there's a customer who needs Python.

---

## Recommended order

1. **Track 2** (Layer 1 DB validation) — half a day
2. **Track 1** (Layer 2 integration tests + publish prep) — two to four days
3. **Track 3** (Layer 3 KYA design) — schedule design review before implementing
4. **Track 4** — when needed, not before
