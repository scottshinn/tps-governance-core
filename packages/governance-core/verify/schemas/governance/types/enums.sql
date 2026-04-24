-- Verify schemas/governance/types/enums on pg

BEGIN;

SELECT verify_type('governance.agent_lifecycle_state');
SELECT verify_type('governance.agent_type');
SELECT verify_type('governance.resource_type');
SELECT verify_type('governance.sensitivity_classification');
SELECT verify_type('governance.data_category');
SELECT verify_type('governance.action_type');
SELECT verify_type('governance.tool_type');
SELECT verify_type('governance.grant_type');
SELECT verify_type('governance.assignment_status');
SELECT verify_type('governance.rule_type');
SELECT verify_type('governance.violation_action');
SELECT verify_type('governance.severity');
SELECT verify_type('governance.rule_status');
SELECT verify_type('governance.scope_level');
SELECT verify_type('governance.framework_type');
SELECT verify_type('governance.requirement_status');
SELECT verify_type('governance.sod_constraint_type');
SELECT verify_type('governance.mcp_auth_method');
SELECT verify_type('governance.mcp_server_status');
SELECT verify_type('governance.audit_action_type');
SELECT verify_type('governance.assessment_method');
SELECT verify_type('governance.risk_level');

ROLLBACK;
