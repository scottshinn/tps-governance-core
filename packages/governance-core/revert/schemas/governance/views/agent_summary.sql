-- Revert schemas/governance/views/agent_summary from pg

BEGIN;

DROP VIEW governance.agent_summary;

COMMIT;
