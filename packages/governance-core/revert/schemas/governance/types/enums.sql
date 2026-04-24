-- Revert schemas/governance/types/enums from pg

BEGIN;

DROP TYPE governance.agent_lifecycle_state;
DROP TYPE governance.agent_type;
DROP TYPE governance.resource_type;
DROP TYPE governance.sensitivity_classification;
DROP TYPE governance.data_category;
DROP TYPE governance.action_type;
DROP TYPE governance.tool_type;
DROP TYPE governance.grant_type;
DROP TYPE governance.assignment_status;
DROP TYPE governance.rule_type;
DROP TYPE governance.violation_action;
DROP TYPE governance.severity;
DROP TYPE governance.rule_status;
DROP TYPE governance.scope_level;
DROP TYPE governance.framework_type;
DROP TYPE governance.requirement_status;
DROP TYPE governance.sod_constraint_type;
DROP TYPE governance.mcp_auth_method;
DROP TYPE governance.mcp_server_status;
DROP TYPE governance.audit_action_type;
DROP TYPE governance.assessment_method;
DROP TYPE governance.risk_level;

COMMIT;
