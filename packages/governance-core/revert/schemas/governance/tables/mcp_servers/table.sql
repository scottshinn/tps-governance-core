-- Revert schemas/governance/tables/mcp_servers/table from pg

BEGIN;

DROP TABLE governance.mcp_servers;

COMMIT;
