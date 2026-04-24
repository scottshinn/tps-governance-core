-- Deploy schemas/governance/types/enums to pg

-- requires: schemas/governance/schema

BEGIN;

-- Agent lifecycle state machine: proposed → under_review → approved → active → suspended → decommissioned
CREATE TYPE governance.agent_lifecycle_state AS ENUM (
  'proposed',
  'under_review',
  'approved',
  'active',
  'suspended',
  'decommissioned'
);

-- Classification of agent autonomy and control model
CREATE TYPE governance.agent_type AS ENUM (
  'orchestrator',
  'worker',
  'autonomous',
  'human_in_the_loop'
);

-- Types of resources an agent can interact with
CREATE TYPE governance.resource_type AS ENUM (
  'database',
  'table',
  'column',
  'api_endpoint',
  'webhook',
  'file_store',
  'mcp_server',
  'external_service',
  'queue',
  'secret_store',
  'model_endpoint'
);

-- Data sensitivity classification levels (ascending sensitivity)
CREATE TYPE governance.sensitivity_classification AS ENUM (
  'public',
  'internal',
  'confidential',
  'restricted',
  'critical'
);

-- Categories of data stored in or flowing through a resource
CREATE TYPE governance.data_category AS ENUM (
  'pii',
  'phi',
  'financial',
  'intellectual_property',
  'authentication_credential',
  'system_configuration',
  'audit_data',
  'customer_data',
  'employee_data'
);

-- Actions that can be performed on resources or granted via permissions
CREATE TYPE governance.action_type AS ENUM (
  'read',
  'write',
  'create',
  'delete',
  'execute',
  'admin',
  'approve',
  'delegate'
);

-- Tool implementation category
CREATE TYPE governance.tool_type AS ENUM (
  'mcp_tool',
  'api_call',
  'database_query',
  'file_operation',
  'webhook_trigger',
  'custom'
);

-- Whether a permission explicitly grants or denies access (deny overrides allow)
CREATE TYPE governance.grant_type AS ENUM (
  'allow',
  'deny'
);

-- Lifecycle state of an agent-role assignment
CREATE TYPE governance.assignment_status AS ENUM (
  'active',
  'suspended',
  'expired',
  'revoked'
);

-- What category of governance check a rule implements
CREATE TYPE governance.rule_type AS ENUM (
  'access_control',
  'segregation_of_duties',
  'data_protection',
  'risk_threshold',
  'coverage_requirement',
  'approval_requirement',
  'delegation_constraint'
);

-- What the system does when a rule is violated
CREATE TYPE governance.violation_action AS ENUM (
  'deny',
  'flag_for_review',
  'require_approval',
  'alert',
  'log_only'
);

-- Impact severity classification
CREATE TYPE governance.severity AS ENUM (
  'critical',
  'high',
  'medium',
  'low',
  'informational'
);

-- Lifecycle state of a governance rule
CREATE TYPE governance.rule_status AS ENUM (
  'draft',
  'active',
  'disabled',
  'deprecated'
);

-- Scope granularity at which a rule, role, or constraint applies
CREATE TYPE governance.scope_level AS ENUM (
  'global',
  'product',
  'agent',
  'resource'
);

-- External compliance framework categories
CREATE TYPE governance.framework_type AS ENUM (
  'regulation',
  'standard',
  'internal_policy',
  'contractual_obligation'
);

-- Whether a compliance requirement is currently satisfied
CREATE TYPE governance.requirement_status AS ENUM (
  'met',
  'partially_met',
  'not_met',
  'not_applicable'
);

-- Which entities the SoD constraint applies to
CREATE TYPE governance.sod_constraint_type AS ENUM (
  'same_agent',    -- no single agent may hold both permission sets
  'same_role',     -- no single role may contain both permission sets
  'same_hierarchy' -- no agent chain from root to leaf may hold both sets
);

-- MCP server authentication method
CREATE TYPE governance.mcp_auth_method AS ENUM (
  'none',
  'api_key',
  'oauth',
  'mtls'
);

-- MCP server operational status
CREATE TYPE governance.mcp_server_status AS ENUM (
  'active',
  'inactive',
  'deprecated'
);

-- Audit log event types — one value per significant governance state change
CREATE TYPE governance.audit_action_type AS ENUM (
  'agent_registered',
  'agent_updated',
  'agent_lifecycle_changed',
  'agent_decommissioned',
  'role_created',
  'role_updated',
  'role_deleted',
  'permission_granted',
  'permission_revoked',
  'permission_updated',
  'assignment_created',
  'assignment_revoked',
  'assignment_suspended',
  'rule_created',
  'rule_modified',
  'rule_activated',
  'rule_disabled',
  'rule_set_created',
  'rule_set_modified',
  'sod_violation_detected',
  'sod_violation_resolved',
  'compliance_framework_added',
  'compliance_requirement_updated',
  'resource_registered',
  'resource_updated',
  'tool_registered',
  'tool_updated',
  'mcp_server_registered',
  'mcp_server_updated',
  'risk_assessment_created',
  'risk_assessment_updated',
  'product_created',
  'product_updated'
);

-- How a risk assessment was produced
CREATE TYPE governance.assessment_method AS ENUM (
  'manual',
  'automated',
  'hybrid'
);

-- Qualitative risk score labels (maps to numeric 1–5 for aggregation)
CREATE TYPE governance.risk_level AS ENUM (
  'negligible',
  'low',
  'moderate',
  'high',
  'critical'
);

COMMIT;
