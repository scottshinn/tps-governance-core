-- Verify schemas/governance/tables/sod_constraints/table on pg

BEGIN;

SELECT verify_table('governance.sod_constraints');

ROLLBACK;
