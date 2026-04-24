-- Verify schemas/governance/tables/rules/table on pg

BEGIN;

SELECT verify_table('governance.rules');

ROLLBACK;
