-- Verify schemas/governance/tables/tools/table on pg

BEGIN;

SELECT verify_table('governance.tools');

ROLLBACK;
