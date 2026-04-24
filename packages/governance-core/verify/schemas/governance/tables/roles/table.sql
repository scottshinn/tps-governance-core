-- Verify schemas/governance/tables/roles/table on pg

BEGIN;

SELECT verify_table('governance.roles');

ROLLBACK;
