# Sanna constitution export

`tps.export.toSannaConstitution(ctx, agentId)` walks the TPS permission model for one agent and emits a Sanna Protocol v1.4 constitution YAML.

Result shape:

```ts
{
  yaml: string,            // canonical YAML output
  policy_hash: string,     // SHA-256 hex of the YAML
  constitution: SannaConstitution,
  metadata: {
    agent_id, agent_name, generated_at, engine_version,
    rule_count, permission_count
  }
}
```

The library **does not** sign. Ed25519 signing is Sanna's responsibility. TPS provides the canonical content + hash; the caller (or Sanna) signs and stores `signature.value`, `key_id`, `signed_by`, `signed_at`.

---

## Mapping reference

| TPS source | Sanna section |
|---|---|
| `agents.name` + `agents.purpose` | `identity.agent_name`, `identity.description` |
| `products.name` (via `agents.product_id`) | `identity.domain` |
| `rules` with `violation_action != 'deny'` | `boundaries[]` (id `B###`) |
| `rules` with `violation_action = 'deny'` | `invariants[]` (id `INV_*`, enforcement `halt`) |
| `rules` with `violation_action = 'deny'` AND `severity = 'critical'` | `halt_conditions[]` (id `H###`) |
| Allow permissions with a `tool_id` | `authority_boundaries.can_execute` (tool name) |
| Deny permissions with a `tool_id` | `authority_boundaries.cannot_execute` (tool name) |
| Allow permissions with `conditions.requires_approval = true` | `authority_boundaries.must_escalate` |
| Tools with `tool_type = 'custom'` or `'file_operation'` | `cli_permissions.commands[]` |
| Tools with `tool_type = 'api_call'` or `'webhook_trigger'` | `api_permissions.endpoints[]` |
| Allow permissions on a resource | `trust_tiers.autonomous` (resource name) |
| Allow + `conditions.requires_approval = true` | `trust_tiers.requires_approval` |
| Deny permissions on a resource | `trust_tiers.prohibited` |

### `rule_type` → `category`

| TPS `rule_type` | Sanna `category` |
|---|---|
| `access_control` | `authorization` |
| `data_protection` | `confidentiality` |
| `segregation_of_duties` | `authorization` |
| `risk_threshold` | `safety` |
| `coverage_requirement` | `compliance` |
| `approval_requirement` | `authorization` |
| `delegation_constraint` | `scope` |
| (anything else) | `custom` |

### Severity mapping

`critical, high, medium, low` pass through. TPS `informational` becomes Sanna `info`.

### HTTP methods

When emitting `api_permissions.endpoints[].methods`, actions translate as:

| Action | HTTP |
|---|---|
| `read` | `GET` |
| `write` | `PUT`, `PATCH` |
| `create` | `POST` |
| `delete` | `DELETE` |
| `execute` | `POST` |

---

## Things TPS does not export

- Provenance signature blocks (`signed_by`, `key_id`, `signature.value`) — caller responsibility
- Identity claims (external identity verifications) — not yet modeled in TPS Layer 1
- Sanna `mode: permissive` — TPS is always explicit (everything is `mode: strict`)
- Tool name normalization (NFKC + camelCase split + casefold) — Sanna's authority evaluator does this; we emit raw `tools.name`

See [`docs/SANNA-PROTOCOL-NOTES.md`](../../../docs/SANNA-PROTOCOL-NOTES.md) at the workspace root for the full Sanna v1.4 surface.

---

## Determinism

The YAML emitter uses `lineWidth: 0` (no wrapping), `sortMapEntries: false` (preserves the structural order in `SannaConstitution`), and `indent: 2`. As long as the TPS state is identical, the YAML — and therefore `policy_hash` — is byte-identical between runs. This matters for Sanna receipt verification: a receipt's `constitution_ref.policy_hash` only matches when the constitution YAML hasn't drifted.

`tools.name`, `resources.name`, etc. are sorted alphabetically inside each section so reordering rows in the database does not perturb the hash.
