-- Verify schemas/governance/tables/resources/table on pg

BEGIN;

SELECT verify_table('governance.resources');

ROLLBACK;
