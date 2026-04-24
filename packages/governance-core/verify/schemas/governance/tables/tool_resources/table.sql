-- Verify schemas/governance/tables/tool_resources/table on pg

BEGIN;

SELECT verify_table('governance.tool_resources');

ROLLBACK;
