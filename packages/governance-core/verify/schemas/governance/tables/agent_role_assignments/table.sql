-- Verify schemas/governance/tables/agent_role_assignments/table on pg

BEGIN;

SELECT verify_table('governance.agent_role_assignments');

ROLLBACK;
