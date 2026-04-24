-- Verify schemas/governance/tables/mcp_servers/table on pg

BEGIN;

SELECT verify_table('governance.mcp_servers');

ROLLBACK;
