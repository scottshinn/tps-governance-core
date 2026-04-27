-- Revert schemas/governance/views/agent_tool_summary from pg

BEGIN;

DROP VIEW governance.agent_tool_summary;

COMMIT;
