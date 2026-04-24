-- Revert schemas/governance/tables/agents/policies/access_policies from pg

BEGIN;

DROP POLICY agents_governance_admin ON governance.agents;
DROP POLICY agents_auditor_select ON governance.agents;
DROP POLICY agents_operator_select ON governance.agents;
DROP POLICY agents_observer_select ON governance.agents;

REVOKE INSERT, UPDATE, DELETE ON TABLE governance.agents FROM authenticated;
REVOKE SELECT ON TABLE governance.agents FROM authenticated;

COMMIT;
