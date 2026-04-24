-- Deploy schemas/governance/views/agent_summary to pg

-- requires: schemas/governance/tables/agents/table
-- requires: schemas/governance/tables/agent_role_assignments/table
-- requires: schemas/governance/tables/risk_assessments/table

BEGIN;

CREATE VIEW governance.agent_summary AS
  SELECT
    a.id,
    a.name,
    a.version,
    a.agent_type,
    a.lifecycle_state,
    a.product_id,
    a.owner,
    a.last_review_at,
    a.review_cycle_days,
    -- Count active role assignments
    (
      SELECT count(*)
      FROM governance.agent_role_assignments ara
      WHERE ara.agent_id = a.id
        AND ara.status = 'active'
        AND (ara.expires_at IS NULL OR ara.expires_at > now())
    ) AS active_role_count,
    -- Latest risk score
    (
      SELECT ra.risk_score
      FROM governance.risk_assessments ra
      WHERE ra.entity_type = 'governance.agents'
        AND ra.entity_id = a.id
      ORDER BY ra.assessed_at DESC
      LIMIT 1
    ) AS latest_risk_score,
    (
      SELECT ra.risk_level
      FROM governance.risk_assessments ra
      WHERE ra.entity_type = 'governance.agents'
        AND ra.entity_id = a.id
      ORDER BY ra.assessed_at DESC
      LIMIT 1
    ) AS latest_risk_level,
    -- Flag agents overdue for review
    CASE
      WHEN a.review_cycle_days IS NOT NULL
        AND a.last_review_at IS NOT NULL
        AND a.last_review_at + (a.review_cycle_days || ' days')::interval < now()
      THEN true
      WHEN a.review_cycle_days IS NOT NULL AND a.last_review_at IS NULL
      THEN true
      ELSE false
    END AS review_overdue,
    a.created_at,
    a.updated_at
  FROM governance.agents a;

COMMENT ON VIEW governance.agent_summary IS
  'Denormalized view of each agent with resolved role count, latest risk score, and review status. Intended for dashboard queries and Layer 2 ingestion.';

COMMIT;
