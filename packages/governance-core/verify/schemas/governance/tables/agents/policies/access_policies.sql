-- Verify schemas/governance/tables/agents/policies/access_policies on pg

BEGIN;

SELECT verify_policy('agents_governance_admin', 'governance.agents');
SELECT verify_policy('agents_auditor_select', 'governance.agents');
SELECT verify_policy('agents_operator_select', 'governance.agents');
SELECT verify_policy('agents_observer_select', 'governance.agents');

ROLLBACK;
