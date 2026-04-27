-- Verify schemas/governance/functions/agent_tool_inventory on pg

BEGIN;

SELECT verify_function('governance.agent_tool_inventory');

ROLLBACK;
