import type postgres from 'postgres';

import type {
  ActionType,
  RequirementStatus,
  ResourceType,
  Rule,
  RuleCondition,
  SensitivityClassification,
  Severity,
  ViolationAction,
} from '../client/types';

/**
 * Strategy-pattern evaluator for a single condition `type` discriminant
 * (D001). Each evaluator runs in the read-only transaction supplied by the
 * dispatcher and returns a {@link RuleResult}.
 */
export interface RuleEvaluator {
  /** Matches the `condition.type` string. */
  readonly type: string;
  evaluate(ctx: EvaluationContext, rule: Rule): Promise<RuleResult>;
}

export interface EvaluationContext {
  sql: postgres.TransactionSql;
  /** When set, evaluators may scope their checks to a single agent. */
  agentId?: string;
  resourceId?: string;
  productId?: string;
}

export interface RuleResult {
  rule_id: string;
  rule_name: string;
  passed: boolean;
  severity: Severity;
  violation_action: ViolationAction;
  details: string;
  affected_entities: {
    agent_ids?: string[];
    resource_ids?: string[];
    permission_ids?: string[];
    role_ids?: string[];
  };
}

/** Rule conditions implemented by the starter evaluators. */
export interface NoAccessToResourceTypeCondition extends RuleCondition {
  type: 'no_access_to_resource_type';
  resource_type: ResourceType;
  except_roles?: string[];
}

export interface MaxSensitiveResourceCountCondition extends RuleCondition {
  type: 'max_sensitive_resource_count';
  sensitivity: SensitivityClassification;
  max_count: number;
}

export interface RequiresApprovalForActionCondition extends RuleCondition {
  type: 'requires_approval_for_action';
  action: ActionType;
  min_sensitivity: SensitivityClassification;
}

export interface NoPiiOutputLeakageCondition extends RuleCondition {
  type: 'no_pii_output_leakage';
}

export interface MaxRoleDepthCondition extends RuleCondition {
  type: 'max_role_depth';
  max_depth: number;
}

export interface NoUnrestrictedAccessCondition extends RuleCondition {
  type: 'no_unrestricted_access';
  min_sensitivity: SensitivityClassification;
  /** Defaults to ['admin', 'delete']. */
  actions?: ActionType[];
}

export interface RequireReviewCycleCondition extends RuleCondition {
  type: 'require_review_cycle';
}

export interface DelegationScopeEnforcementCondition extends RuleCondition {
  type: 'delegation_scope_enforcement';
}

export interface ComplianceReport {
  framework_id: string;
  framework_name: string;
  framework_version: string | null;
  /** Per-requirement evaluation summary. */
  requirements: ComplianceRequirementReport[];
  status: RequirementStatus;
}

export interface ComplianceRequirementReport {
  requirement_id: string;
  reference_code: string;
  description: string;
  status: RequirementStatus;
  rule_results: RuleResult[];
}
