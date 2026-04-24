-- Verify schemas/governance/views/agent_topology on pg

BEGIN;

SELECT verify_view('governance.agent_topology');

ROLLBACK;
