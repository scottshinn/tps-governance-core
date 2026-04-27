-- Verify schemas/governance/views/agent_tool_summary on pg

BEGIN;

SELECT verify_view('governance.agent_tool_summary');

ROLLBACK;
