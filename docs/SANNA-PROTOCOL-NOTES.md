# Sanna Protocol — Notes for TPS Layer 2

This document captures what was learned from studying the Sanna Protocol v1.4 specification, the Python SDK (`sanna`), the TypeScript SDK (`@sanna-ai/core`), and the constitution JSON schema. It is written from the perspective of **TPS as a complementary system**, not a fork or reimplementation.

**License note:** Sanna is AGPL-3.0. We are NOT copying code, NOT forking the protocol, and NOT implementing a competing receipt format. We are studying it to understand what our schema must model as the *authoring and management layer* for governance rules that Sanna enforces.

---

## What Sanna Does (Enforcement Layer)

Sanna is the runtime enforcement and receipt-generation layer. Its job:

1. Load a **constitution** (YAML governance document) for an agent
2. At execution time, **evaluate checks** against agent inputs and outputs
3. **Enforce boundaries** — halt, warn, log, or escalate based on rule results
4. **Generate a signed receipt** proving governance was applied

Sanna answers: "Did this specific agent action comply with its governance policy, right now?"

TPS answers: "What should the governance policy be? Who holds what permissions? Where are the gaps? Is the current policy consistent?"

The two systems are complementary at the boundary between authoring (TPS) and enforcement (Sanna).

---

## Constitution Format — What TPS Must Model

A Sanna constitution is a YAML document with six main sections:

### 1. identity
```yaml
identity:
  agent_name: my-agent           # Unique identifier
  domain: customer-service       # Business domain
  description: "..."             # What this agent does
  identity_claims: [...]         # External identity verifications (provider, credential_id, signature)
```

TPS equivalent: `governance.agents` table. The `name`, `purpose` (≈description), `agent_type`, and `product_id` (≈domain) fields cover this. Identity claims are not yet modeled — future enhancement.

### 2. provenance
```yaml
provenance:
  authored_by: alice@example.com
  approved_by: [alice@example.com, bob@example.com]
  approval_date: "2026-04-01"
  approval_method: "email-thread"
  signature:                     # Ed25519 signature over the document
    value: "base64..."
    key_id: "64-hex SHA-256 of public key"
    signed_by: "alice@example.com"
    signed_at: "2026-04-01T..."
    scheme: "constitution_sig_v1"
```

TPS equivalent: `agent_role_assignments.assigned_by` and `agent_role_assignments.reason` partially cover this. Full constitution provenance (who approved it, cryptographic signature) is not yet in the schema — this is a strong candidate for Layer 2's constitution export feature. The approval chain model (`approval.records[].approver_id`, `approver_role`, `approval_signature`) is particularly important for regulated industries.

### 3. boundaries
```yaml
boundaries:
  - id: B001                       # B### pattern
    description: "Agent may only read data autonomously"
    category: scope                # scope | authorization | confidentiality | safety | compliance | custom
    severity: high                 # critical | high | medium | low | info
```

TPS equivalent: `governance.rules` table. Each boundary maps to a rule. The `category` maps approximately to `rule_type`. The `severity` maps to `governance.severity`. The `B###` ID pattern could be stored in a `reference_code` column (not currently in the schema — future addition).

### 4. authority_boundaries
```yaml
authority_boundaries:
  can_execute:
    - "*_search"
    - "*_read"
  must_escalate:
    - condition: "Any write operation"
      target:
        type: webhook
        url: "https://..."
  cannot_execute:
    - "shell_*"
    - "*_credential*"
```

TPS equivalent: `governance.permissions` with `grant_type = 'allow'` (can_execute) and `grant_type = 'deny'` (cannot_execute). The `must_escalate` tier maps to permissions with `conditions = {"requires_approval": true}` or a rule with `violation_action = 'require_approval'`. Tool name patterns (wildcards) are not directly modeled in TPS — TPS uses exact tool references.

### 5. invariants
```yaml
invariants:
  - id: INV_NO_FABRICATION          # INV_* for standard, INV_CUSTOM_* for custom
    rule: "Agent must not fabricate information"
    enforcement: halt               # halt | warn | log
    check: sanna.context_contradiction  # Named check implementation
```

TPS equivalent: `governance.rules`. The `condition` jsonb field stores the rule condition; `violation_action` maps to `enforcement`; the `check` implementation ID is implicitly encoded in the condition's `"type"` field.

### 6. cli_permissions and api_permissions
```yaml
cli_permissions:
  mode: strict                     # strict | permissive
  justification_required: true
  commands:
    - id: cli-001
      binary: curl
      authority: cannot_execute
      argv_pattern: "*"

api_permissions:
  mode: strict
  endpoints:
    - id: api-001
      url_pattern: "https://internal-api/*"
      methods: [GET]
      authority: can_execute
```

TPS equivalent: These map to `governance.tools` + `governance.permissions`. CLI binaries map to tools with `tool_type = 'custom'`; API endpoints map to tools with `tool_type = 'api_call'`. The `mode: strict` (deny-by-default) vs `mode: permissive` (allow-by-default) pattern has no direct TPS equivalent — TPS is always explicit. The `justification_required` flag could be stored in `permissions.conditions` as `{"justification_required": true}`.

### halt_conditions
```yaml
halt_conditions:
  - id: H001                       # H### pattern
    trigger: "Credential access attempted"
    escalate_to: "security-team@example.com"
    severity: critical
    enforcement: halt
```

TPS equivalent: `governance.rules` with `violation_action = 'deny'` and `severity = 'critical'`. The escalation target is not currently modeled — a future `rules.escalation_target` jsonb column could store this.

### trust_tiers
```yaml
trust_tiers:
  autonomous: [internal-db, analytics-api]
  requires_approval: [external-api]
  prohibited: [production-delete]
```

TPS equivalent: This maps directly to `governance.resources` sensitivity classifications combined with permissions. `autonomous` ≈ resources with existing allow permissions; `requires_approval` ≈ resources with `conditions = {"requires_approval": true}`; `prohibited` ≈ resources with explicit deny permissions.

---

## Receipt Format — What TPS Might Store

A Sanna receipt is a JSON document proving governance was applied. Key fields TPS might eventually ingest:

| Field | Type | TPS Relevance |
|---|---|---|
| `receipt_id` | uuid | Could be stored in audit_log for cross-reference |
| `correlation_id` | string | Maps to `audit_log.correlation_id` |
| `timestamp` | ISO 8601 | Maps to `audit_log.occurred_at` |
| `checks` | array of CheckResult | Could become a governance_events table |
| `status` | PASS/WARN/FAIL/PARTIAL | Could feed `risk_assessments` |
| `constitution_ref.document_id` | `{agent_name}/{version}` | Links receipt to the agent |
| `constitution_ref.policy_hash` | SHA-256 | Proves which policy version was enforced |
| `enforcement.action` | halted/warned/allowed | The enforcement outcome |
| `agent_model` | string | Which LLM was running |

**Current state:** TPS Layer 1 does not store receipts. Receipt storage belongs in Layer 2 (possibly as a separate pgpm module `@tpsdev/receipt-store`). The schema should be designed to make receipt ingestion easy — the `correlation_id` column in `audit_log` can link TPS governance events to Sanna receipt IDs.

---

## Check System — What We Modeled

Sanna's built-in checks (C1–C5, plus named checks):

| Check ID | Name | Type |
|---|---|---|
| `C1` | Source contradiction | Semantic: LLM evaluates whether output contradicts context |
| `C2` | PII leakage | Pattern matching on outputs |
| `C3` | Prompt injection | Input scanning for manipulation attempts |
| `C4` | System prompt leak | Output scanning for leaked instructions |
| `C5` | Scope boundary | Does output stay within stated purpose |
| `INV_NO_FABRICATION` | Anti-hallucination | `sanna.context_contradiction` |
| `INV_MARK_INFERENCE` | Inference marking | `sanna.unmarked_inference` |

TPS models the *policy intent* ("no PII leakage"), not the *runtime check* ("did this specific output contain PII"). The bridge between the two:
- TPS `rules.condition = {"type": "no_pii_output_leakage"}` declares the requirement
- Sanna's C2 check enforces it at runtime
- The Sanna receipt proves it was checked
- Layer 2 reads TPS rules and maps them to Sanna check IDs when exporting constitutions

---

## Authority Evaluation Model

Sanna's authority evaluator uses a **priority cascade**:

1. Per-tool override (exact name match)
2. Server default policy
3. Constitution `authority_boundaries` (with name normalization)
4. No match → `cannot_execute` (fail-closed)

**Name normalization** for matching tool names against boundary patterns:
1. NFKC normalize
2. Split camelCase at case transitions
3. Split on separators (`_-./:\@`)
4. Casefold all tokens
5. Join with `.`

TPS does not implement name normalization — TPS uses exact tool references (the `tools.name` column). When Layer 2 exports a Sanna constitution, it should convert TPS tool names to Sanna's normalized form.

---

## Enforcement Levels

Sanna has three enforcement levels:
- **halt** — block the action, raise `SannaHaltError`, generate a FAIL receipt
- **warn** — allow the action, add a warning to the receipt, status = WARN
- **log** — allow the action, note it in the receipt, status = PASS

TPS equivalent (`violation_action` enum):
- `deny` ≈ `halt`
- `flag_for_review` ≈ `warn`
- `require_approval` ≈ escalation (must_escalate)
- `alert` ≈ webhook-based log
- `log_only` ≈ `log`

---

## Gateway Mode

Sanna can run as an MCP enforcement proxy — sitting between the agent and MCP servers, checking every tool call against the constitution before forwarding it.

This has direct implications for TPS `mcp_servers` modeling: in a Sanna gateway deployment, each MCP server registered in TPS should have the gateway endpoint (not the raw server endpoint) as its `endpoint_url`. The actual tool routing happens inside the gateway.

Future consideration: a `governance.mcp_gateways` table (or a `mcp_servers.is_gateway` flag) to model this topology.

---

## Cryptographic Model

For TPS reference (not for implementation — Sanna handles this):

- **Algorithm:** Pure Ed25519 (RFC 8032), no context string, no pre-hashing
- **Constitution signing:** SHA-256 of canonical constitution content
- **Receipt fingerprint:** 14-field pipe-delimited SHA-256 (Sanna protocol v1.4)
- **Canonicalization:** Sanna Canonical JSON (byte-sorted keys, no whitespace, no HTML escaping, NFC Unicode normalization)
- **Key ID:** SHA-256 of the raw 32-byte Ed25519 public key (not DER)
- **Approval chain:** Ed25519 signature of each approval record, content_hash links versions

If TPS Layer 2 exports Sanna-compatible YAML, it must:
1. Generate a `policy_hash = SHA-256(canonical_constitution_yaml)`
2. Sign with the organization's Ed25519 private key
3. Store the `signed_by`, `key_id`, `signature.value`, `signed_at` fields

---

## What TPS Does NOT Implement

Do not add these to Layer 1 or Layer 2 without explicit product decision:

- **Runtime check evaluation** — Sanna does this. TPS defines rules declaratively.
- **Receipt signing** — Sanna does this. TPS might store receipt references.
- **JWT/API authentication** — Not TPS's concern. TPS assumes identity is established by the calling application.
- **Prompt injection detection** — Sanna's C3 check. TPS can declare a rule saying "must check for prompt injection" but doesn't implement the check.
- **LLM-as-judge evaluation** — Sanna's reasoning receipt subsystem. TPS models the policy, not the evaluation.
- **Ed25519 key management** — Not TPS's concern at Layer 1.

---

## Potential Future Integration Points

| Feature | Description | Layer |
|---|---|---|
| Constitution export | Convert TPS permission model → Sanna YAML constitution | Layer 2 |
| Receipt ingestion | Parse Sanna receipts and store enforcement outcomes | Layer 2 / new module |
| Policy drift detection | Compare TPS rules against the constitution that Sanna is actually enforcing | Layer 2 |
| Compliance tracing | Link Sanna check IDs to TPS compliance requirements | Layer 2 |
| Gap detection | Find TPS rules that have no corresponding Sanna invariant | Layer 2 |
