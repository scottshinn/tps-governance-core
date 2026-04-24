-- Revert schemas/governance/views/agent_topology from pg

BEGIN;

DROP VIEW governance.agent_topology;

COMMIT;
