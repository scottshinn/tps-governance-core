/**
 * Sanna Protocol v1.4 constitution types — minimal TypeScript shape
 * sufficient for TPS export. See docs/SANNA-PROTOCOL-NOTES.md for the
 * mapping rationale. Sanna is AGPL-3.0; we ARE NOT copying their schema,
 * we are emitting a subset that conforms to the published format.
 */

export type SannaSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type SannaCategory =
  | 'scope'
  | 'authorization'
  | 'confidentiality'
  | 'safety'
  | 'compliance'
  | 'custom';
export type SannaEnforcement = 'halt' | 'warn' | 'log';

export interface SannaIdentity {
  agent_name: string;
  domain?: string;
  description?: string;
}

export interface SannaBoundary {
  id: string;
  description: string;
  category: SannaCategory;
  severity: SannaSeverity;
}

export interface SannaInvariant {
  id: string;
  rule: string;
  enforcement: SannaEnforcement;
  check?: string;
}

export interface SannaEscalationTarget {
  type: 'human' | 'webhook' | 'queue';
  contact?: string;
  url?: string;
  queue?: string;
}

export interface SannaMustEscalate {
  condition: string;
  target: SannaEscalationTarget;
}

export interface SannaAuthorityBoundaries {
  can_execute?: string[];
  cannot_execute?: string[];
  must_escalate?: SannaMustEscalate[];
}

export interface SannaCliCommand {
  id: string;
  binary: string;
  authority: 'can_execute' | 'cannot_execute' | 'must_escalate';
  argv_pattern?: string;
}

export interface SannaCliPermissions {
  mode: 'strict' | 'permissive';
  justification_required?: boolean;
  commands?: SannaCliCommand[];
}

export interface SannaApiEndpoint {
  id: string;
  url_pattern: string;
  methods: string[];
  authority: 'can_execute' | 'cannot_execute' | 'must_escalate';
}

export interface SannaApiPermissions {
  mode: 'strict' | 'permissive';
  endpoints?: SannaApiEndpoint[];
}

export interface SannaTrustTiers {
  autonomous?: string[];
  requires_approval?: string[];
  prohibited?: string[];
}

export interface SannaHaltCondition {
  id: string;
  trigger: string;
  escalate_to?: string;
  severity: SannaSeverity;
  enforcement: 'halt';
}

export interface SannaConstitution {
  constitution_version: string;
  identity: SannaIdentity;
  boundaries?: SannaBoundary[];
  invariants?: SannaInvariant[];
  authority_boundaries?: SannaAuthorityBoundaries;
  cli_permissions?: SannaCliPermissions;
  api_permissions?: SannaApiPermissions;
  trust_tiers?: SannaTrustTiers;
  halt_conditions?: SannaHaltCondition[];
}

export interface SannaExportResult {
  yaml: string;
  /** SHA-256 hex digest of the canonical YAML content. */
  policy_hash: string;
  constitution: SannaConstitution;
  metadata: {
    agent_id: string;
    agent_name: string;
    generated_at: string;
    engine_version: string;
    rule_count: number;
    permission_count: number;
  };
}
