-- Verify schemas/governance/tables/permissions/table on pg

BEGIN;

SELECT verify_table('governance.permissions');

ROLLBACK;
