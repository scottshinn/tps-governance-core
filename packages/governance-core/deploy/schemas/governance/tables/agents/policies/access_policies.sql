-- Deploy schemas/governance/tables/agents/policies/access_policies to pg

-- requires: schemas/governance/tables/agents/table
-- requires: schemas/governance/tables/agents/policies/enable_rls

BEGIN;

-- governance_admin: full read/write access
CREATE POLICY agents_governance_admin ON governance.agents
  FOR ALL
  USING (current_setting('tps.role', true) IN ('governance_admin', 'system_admin'))
  WITH CHECK (current_setting('tps.role', true) IN ('governance_admin', 'system_admin'));

-- auditor: read-only access to all agents
CREATE POLICY agents_auditor_select ON governance.agents
  FOR SELECT
  USING (current_setting('tps.role', true) = 'auditor');

-- agent_operator: read-only access to active/approved agents only
CREATE POLICY agents_operator_select ON governance.agents
  FOR SELECT
  USING (
    current_setting('tps.role', true) = 'agent_operator'
    AND lifecycle_state IN ('approved', 'active')
  );

-- read_only_observer: read-only access to active agents only
CREATE POLICY agents_observer_select ON governance.agents
  FOR SELECT
  USING (
    current_setting('tps.role', true) = 'read_only_observer'
    AND lifecycle_state = 'active'
  );

GRANT SELECT ON TABLE governance.agents TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE governance.agents TO authenticated;

COMMIT;
