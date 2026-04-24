-- Revert schemas/governance/tables/tool_resources/table from pg

BEGIN;

DROP TABLE governance.tool_resources;

COMMIT;
