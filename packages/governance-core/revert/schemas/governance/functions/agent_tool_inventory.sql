-- Revert schemas/governance/functions/agent_tool_inventory from pg

BEGIN;

DROP FUNCTION governance.agent_tool_inventory;

COMMIT;
