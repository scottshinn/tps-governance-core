-- Verify schemas/governance/functions/attach_audit_triggers on pg

BEGIN;

SELECT verify_trigger('governance.tg_audit_agents');
SELECT verify_trigger('governance.tg_audit_roles');
SELECT verify_trigger('governance.tg_audit_permissions');
SELECT verify_trigger('governance.tg_audit_agent_role_assignments');
SELECT verify_trigger('governance.tg_audit_rules');

ROLLBACK;
