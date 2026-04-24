-- Verify schemas/governance/tables/sod_constraint_permissions/table on pg

BEGIN;

SELECT verify_table('governance.sod_constraint_permissions');

ROLLBACK;
