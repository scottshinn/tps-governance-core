-- Revert schemas/governance/indexes/performance_indexes from pg

BEGIN;

DROP INDEX IF EXISTS governance.idx_agent_role_assignments_active_live;
DROP INDEX IF EXISTS governance.idx_permissions_allow;
DROP INDEX IF EXISTS governance.idx_permissions_deny;
DROP INDEX IF EXISTS governance.idx_permissions_resource_grant;
DROP INDEX IF EXISTS governance.idx_tool_resources_tool_id;
DROP INDEX IF EXISTS governance.idx_resource_data_categories_pii;
DROP INDEX IF EXISTS governance.idx_audit_log_entity_time;
DROP INDEX IF EXISTS governance.idx_rules_active;
DROP INDEX IF EXISTS governance.idx_sod_constraint_perms_lookup;

COMMIT;
