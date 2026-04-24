-- Verify schemas/governance/views/agent_summary on pg

BEGIN;

SELECT verify_view('governance.agent_summary');

ROLLBACK;
