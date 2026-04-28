/**
 * TypeScript types mirroring the @tpsdev/governance-core PostgreSQL schema.
 * Source of truth: governance-core/docs/DATA-MODEL-REFERENCE.md.
 */

// ---------- Enums ----------

export type AgentLifecycleState =
  | 'proposed'
  | 'under_review'
  | 'approved'
  | 'active'
  | 'suspended'
  | 'decommissioned';

export type AgentType = 'orchestrator' | 'worker' | 'autonomous' | 'human_in_the_loop';

export type ResourceType =
  | 'database'
  | 'table'
  | 'column'
  | 'api_endpoint'
  | 'webhook'
  | 'file_store'
  | 'mcp_server'
  | 'external_service'
  | 'queue'
  | 'secret_store'
  | 'model_endpoint';

export type SensitivityClassification =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted'
  | 'critical';

export type DataCategory =
  | 'pii'
  | 'phi'
  | 'financial'
  | 'intellectual_property'
  | 'authentication_credential'
  | 'system_configuration'
  | 'audit_data'
  | 'customer_data'
  | 'employee_data';

export type ActionType =
  | 'read'
  | 'write'
  | 'create'
  | 'delete'
  | 'execute'
  | 'admin'
  | 'approve'
  | 'delegate';

export type ToolType =
  | 'mcp_tool'
  | 'api_call'
  | 'database_query'
  | 'file_operation'
  | 'webhook_trigger'
  | 'custom';

export type GrantType = 'allow' | 'deny';

export type AssignmentStatus = 'active' | 'suspended' | 'expired' | 'revoked';

export type RuleType =
  | 'access_control'
  | 'segregation_of_duties'
  | 'data_protection'
  | 'risk_threshold'
  | 'coverage_requirement'
  | 'approval_requirement'
  | 'delegation_constraint';

export type ViolationAction =
  | 'deny'
  | 'flag_for_review'
  | 'require_approval'
  | 'alert'
  | 'log_only';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export type RuleStatus = 'draft' | 'active' | 'disabled' | 'deprecated';

export type ScopeLevel = 'global' | 'product' | 'agent' | 'resource';

export type FrameworkType = 'regulation' | 'standard' | 'internal_policy' | 'contractual_obligation';

export type RequirementStatus = 'met' | 'partially_met' | 'not_met' | 'not_applicable';

export type SodConstraintType = 'same_agent' | 'same_role' | 'same_hierarchy';

export type McpAuthMethod = 'none' | 'api_key' | 'oauth' | 'mtls';

export type McpServerStatus = 'active' | 'inactive' | 'deprecated';

export type AssessmentMethod = 'manual' | 'automated' | 'hybrid';

export type RiskLevel = 'negligible' | 'low' | 'moderate' | 'high' | 'critical';

export type AuditActionType =
  | 'agent_registered'
  | 'agent_updated'
  | 'agent_lifecycle_changed'
  | 'agent_decommissioned'
  | 'role_created'
  | 'role_updated'
  | 'role_deleted'
  | 'permission_granted'
  | 'permission_revoked'
  | 'permission_updated'
  | 'assignment_created'
  | 'assignment_revoked'
  | 'assignment_suspended'
  | 'rule_created'
  | 'rule_modified'
  | 'rule_activated'
  | 'rule_disabled'
  | 'rule_set_created'
  | 'rule_set_modified'
  | 'sod_violation_detected'
  | 'sod_violation_resolved'
  | 'compliance_framework_added'
  | 'compliance_requirement_updated'
  | 'resource_registered'
  | 'resource_updated'
  | 'tool_registered'
  | 'tool_updated'
  | 'mcp_server_registered'
  | 'mcp_server_updated'
  | 'risk_assessment_created'
  | 'risk_assessment_updated'
  | 'product_created'
  | 'product_updated';

// Built-in role names (D023). Custom roles can also be assigned to tps.role.
export type BuiltInRole =
  | 'system_admin'
  | 'governance_admin'
  | 'agent_operator'
  | 'auditor'
  | 'read_only_observer';

export type TpsRole = BuiltInRole | (string & { readonly __brand?: unique symbol });

// ---------- Sensitivity ordering helpers ----------

export const SENSITIVITY_ORDER: Record<SensitivityClassification, number> = {
  public: 1,
  internal: 2,
  confidential: 3,
  restricted: 4,
  critical: 5,
};

export const RISK_LEVEL_BY_SCORE: Record<1 | 2 | 3 | 4 | 5, RiskLevel> = {
  1: 'negligible',
  2: 'low',
  3: 'moderate',
  4: 'high',
  5: 'critical',
};

// ---------- Context ----------

export interface TpsContext {
  /** Stored as `tps.current_actor` for audit attribution (D016). */
  actor: string;
  /** Stored as `tps.role` for RLS evaluation (D007). */
  role: TpsRole;
  /** Optional correlation ID grouped on audit_log entries written under this context. */
  correlation_id?: string;
}

// ---------- Pagination ----------

export interface PaginatedResult<T> {
  items: T[];
  next_cursor: string | null;
  total_count?: number;
}

// ---------- Table interfaces ----------

export interface Product {
  id: string;
  name: string;
  description: string | null;
  owner: string;
  created_at: Date;
  updated_at: Date;
}

export interface McpServer {
  id: string;
  name: string;
  description: string | null;
  endpoint_url: string;
  status: McpServerStatus;
  auth_method: McpAuthMethod;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface Agent {
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

export interface Resource {
  id: string;
  name: string;
  description: string | null;
  resource_type: ResourceType;
  sensitivity: SensitivityClassification;
  supported_actions: ActionType[];
  location: string | null;
  owner: string | null;
  product_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface Tool {
  id: string;
  name: string;
  description: string | null;
  tool_type: ToolType;
  mcp_server_id: string | null;
  parameters: Record<string, unknown> | null;
  risk_profile: string | null;
  is_idempotent: boolean;
  is_destructive: boolean;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  parent_role_id: string | null;
  scope: ScopeLevel;
  is_built_in: boolean;
  max_assignments: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface Permission {
  id: string;
  role_id: string;
  resource_id: string;
  tool_id: string | null;
  actions: ActionType[];
  conditions: Record<string, unknown> | null;
  grant_type: GrantType;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AgentRoleAssignment {
  id: string;
  agent_id: string;
  role_id: string;
  assigned_by: string;
  reason: string | null;
  status: AssignmentStatus;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ResourceDataCategory {
  resource_id: string;
  data_category: DataCategory;
}

export interface ToolResource {
  tool_id: string;
  resource_id: string;
  actions: ActionType[];
}

export interface ComplianceFramework {
  id: string;
  name: string;
  version: string | null;
  description: string | null;
  framework_type: FrameworkType;
  effective_date: Date | null;
  review_date: Date | null;
  source_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ComplianceRequirement {
  id: string;
  framework_id: string;
  reference_code: string;
  description: string;
  status: RequirementStatus;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Rule {
  id: string;
  name: string;
  description: string | null;
  rule_type: RuleType;
  condition: RuleCondition;
  violation_action: ViolationAction;
  severity: Severity;
  status: RuleStatus;
  scope: ScopeLevel;
  scope_entity_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/** A `jsonb` rule condition. Always carries a `type` discriminant (D001). */
export interface RuleCondition {
  type: string;
  [key: string]: unknown;
}

export interface RuleSet {
  id: string;
  name: string;
  description: string | null;
  scope: ScopeLevel;
  scope_entity_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface RuleSetRule {
  rule_set_id: string;
  rule_id: string;
}

export interface RuleComplianceReq {
  rule_id: string;
  requirement_id: string;
}

export interface SodConstraint {
  id: string;
  name: string;
  description: string | null;
  constraint_type: SodConstraintType;
  severity: Severity;
  is_active: boolean;
  compliance_req_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SodConstraintPermission {
  constraint_id: string;
  permission_id: string;
  side: 'a' | 'b';
}

export interface AuditLogEntry {
  id: string;
  occurred_at: Date;
  actor: string | null;
  action_type: AuditActionType;
  entity_type: string;
  entity_id: string;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  reason: string | null;
  correlation_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface RiskAssessment {
  id: string;
  entity_type: string;
  entity_id: string;
  risk_level: RiskLevel;
  risk_score: 1 | 2 | 3 | 4 | 5;
  risk_factors: RiskFactor[];
  assessment_method: AssessmentMethod;
  assessor: string | null;
  notes: string | null;
  assessed_at: Date;
  valid_until: Date | null;
  created_at: Date;
}

export interface RiskFactor {
  factor: string;
  weight: number;
  description: string;
  /** Free-form details captured by the scoring engine — agent IDs, counts, etc. */
  details?: Record<string, unknown>;
}

// ---------- Function return shapes ----------

export interface EffectivePermission {
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

export interface SodCheckRow {
  constraint_id: string;
  constraint_name: string;
  constraint_type: SodConstraintType;
  severity: Severity;
  side_a_perm_ids: string[];
  side_b_perm_ids: string[];
}

export interface BlastRadiusRow {
  resource_id: string;
  resource_name: string;
  resource_type: ResourceType;
  sensitivity: SensitivityClassification;
  effective_actions: ActionType[];
  access_paths: string[];
}

export interface PermissionOverlapRow {
  agent_id: string;
  agent_name: string;
  agent_type: AgentType;
  lifecycle_state: AgentLifecycleState;
  effective_actions: ActionType[];
  permission_count: number;
}

export interface CoverageGapRow {
  resource_id: string;
  resource_name: string;
  resource_type: ResourceType;
  sensitivity: SensitivityClassification;
  has_permission: boolean;
  has_rule: boolean;
}

export interface AgentToolInventoryRow {
  tool_id: string;
  tool_name: string;
  tool_type: ToolType;
  mcp_server_id: string | null;
  mcp_server_name: string | null;
  is_destructive: boolean;
  is_idempotent: boolean;
  resource_count: number;
  effective_actions: ActionType[];
  granted_via_role_name: string;
  granted_via_role_depth: number;
}

// ---------- Net effective access (computed in this library) ----------

export interface NetPermission {
  resource_id: string;
  tool_id: string | null;
  /** Actions allowed by at least one allow grant. */
  allowed_actions: ActionType[];
  /** Actions denied by at least one deny grant (broader scope wins). */
  denied_actions: ActionType[];
  /** allowed_actions minus denied_actions — the final effective set. */
  net_actions: ActionType[];
  /** Aggregated ABAC conditions from allow grants only. */
  conditions: Record<string, unknown>[];
  /** One row per (action, grant) showing where each action came from. */
  grant_lineage: PermissionLineage[];
}

export interface PermissionLineage {
  action: ActionType;
  grant_type: GrantType;
  role_name: string;
  role_depth: number;
  permission_id: string;
  /** True when this grant's tool_id is null (applies to "any tool"). */
  any_tool: boolean;
}
