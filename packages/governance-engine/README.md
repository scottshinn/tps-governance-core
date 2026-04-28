# @tpsdev/governance-engine

TypeScript query, analysis, and intelligence layer for the TPS governance schema.

`governance-engine` sits on top of [`@tpsdev/governance-core`](../governance-core) and provides:

- A typed client for every governance entity (agents, roles, permissions, resources, tools, rules, ...)
- **Net effective access** computation — resolves `deny`-overrides-`allow` from raw permission grants
- **Governance intelligence** — SoD violations, blast radius, permission overlap, coverage gaps, tool inventory, automated risk scoring
- **Rule evaluation engine** — pluggable evaluators for `jsonb` rule conditions, plus compliance reports
- **Point-in-time reconstruction** — replay the audit log to answer "what could agent X do at timestamp T?"
- **Sanna constitution export** — emit Sanna Protocol v1.4 YAML constitutions with policy hash

This is a **library**, not a server. It is consumed by Layer 3 (TPS KYA) and any custom integration that needs to read or mutate governance state.

## Install

```sh
pnpm add @tpsdev/governance-engine postgres
```

`postgres` (postgresjs) is a peer of the connection plumbing — pass an existing instance or let `TpsClient` create one for you.

## Quick start

```ts
import { TpsClient } from '@tpsdev/governance-engine';

const tps = new TpsClient({
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'governance_dev',
    username: 'postgres',
    password: 'postgres',
  },
});

const ctx = { actor: 'alice@example.com', role: 'governance_admin' as const };

const agent = await tps.agents.create(ctx, {
  name: 'payment-processor',
  purpose: 'Process customer payments via Stripe',
  agent_type: 'worker',
  owner: 'payments-team',
});

const net = await tps.intelligence.netEffectivePermissions(ctx, agent.id);
const violations = await tps.intelligence.sodCheck(ctx, agent.id);
const exposure = await tps.intelligence.blastRadius(ctx, agent.id);
const tools = await tps.intelligence.toolInventory(ctx, agent.id);
const constitution = await tps.export.toSannaConstitution(ctx, agent.id);

await tps.close();
```

## Documentation

- [`docs/API.md`](./docs/API.md) — full method reference
- [`docs/RULE-CONDITIONS.md`](./docs/RULE-CONDITIONS.md) — catalog of rule condition types
- [`docs/SANNA-EXPORT.md`](./docs/SANNA-EXPORT.md) — TPS→Sanna mapping

## License

MIT
