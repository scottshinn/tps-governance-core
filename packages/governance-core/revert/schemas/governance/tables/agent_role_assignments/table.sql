-- Revert schemas/governance/tables/agent_role_assignments/table from pg

BEGIN;

DROP TABLE governance.agent_role_assignments;

COMMIT;
