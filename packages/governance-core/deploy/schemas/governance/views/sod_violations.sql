-- Deploy schemas/governance/views/sod_violations to pg

-- requires: schemas/governance/tables/agents/table
-- requires: schemas/governance/tables/sod_constraints/table
-- requires: schemas/governance/functions/sod_check

BEGIN;

CREATE VIEW governance.sod_violations AS
  SELECT
    a.id             AS agent_id,
    a.name           AS agent_name,
    a.lifecycle_state,
    v.constraint_id,
    v.constraint_name,
    v.constraint_type,
    v.severity,
    v.side_a_perm_ids,
    v.side_b_perm_ids
  FROM governance.agents a
  CROSS JOIN LATERAL governance.sod_check(a.id) v
  WHERE a.lifecycle_state IN ('approved', 'active');

COMMENT ON VIEW governance.sod_violations IS
  'Current SoD violations across all active and approved agents. Each row represents one constraint violated by one agent. Intended for compliance dashboards and alerting queries.';

COMMIT;
