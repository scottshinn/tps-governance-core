-- Verify schemas/governance/indexes/performance_indexes on pg

BEGIN;

SELECT verify_index('governance.agent_role_assignments', 'idx_agent_role_assignments_active_live');
SELECT verify_index('governance.permissions', 'idx_permissions_allow');
SELECT verify_index('governance.permissions', 'idx_permissions_deny');
SELECT verify_index('governance.permissions', 'idx_permissions_resource_grant');
SELECT verify_index('governance.tool_resources', 'idx_tool_resources_tool_id');
SELECT verify_index('governance.resource_data_categories', 'idx_resource_data_categories_pii');
SELECT verify_index('governance.audit_log', 'idx_audit_log_entity_time');
SELECT verify_index('governance.rules', 'idx_rules_active');
SELECT verify_index('governance.sod_constraint_permissions', 'idx_sod_constraint_perms_lookup');

ROLLBACK;
