-- Deploy schemas/governance/views/resource_exposure to pg

-- requires: schemas/governance/tables/resources/table
-- requires: schemas/governance/tables/resource_data_categories/table
-- requires: schemas/governance/tables/permissions/table
-- requires: schemas/governance/tables/roles/table
-- requires: schemas/governance/tables/agent_role_assignments/table
-- requires: schemas/governance/tables/agents/table

BEGIN;

CREATE VIEW governance.resource_exposure AS
  SELECT
    r.id            AS resource_id,
    r.name          AS resource_name,
    r.resource_type,
    r.sensitivity,
    r.location,
    -- All data categories on this resource
    array_agg(DISTINCT rdc.data_category ORDER BY rdc.data_category) FILTER (WHERE rdc.data_category IS NOT NULL) AS data_categories,
    -- Count of distinct active agents that can access this resource
    count(DISTINCT ara.agent_id) FILTER (
      WHERE ara.status = 'active'
        AND (ara.expires_at IS NULL OR ara.expires_at > now())
        AND p.grant_type = 'allow'
        AND (p.expires_at IS NULL OR p.expires_at > now())
    ) AS active_agent_count,
    -- Whether any permission grants delete action
    bool_or(
      'delete' = ANY(p.actions)
      AND p.grant_type = 'allow'
      AND (p.expires_at IS NULL OR p.expires_at > now())
    ) AS has_delete_grant,
    -- Whether any permission grants admin action
    bool_or(
      'admin' = ANY(p.actions)
      AND p.grant_type = 'allow'
      AND (p.expires_at IS NULL OR p.expires_at > now())
    ) AS has_admin_grant
  FROM governance.resources r
  LEFT JOIN governance.resource_data_categories rdc ON rdc.resource_id = r.id
  LEFT JOIN governance.permissions p ON p.resource_id = r.id
  LEFT JOIN governance.roles ro ON ro.id = p.role_id
  LEFT JOIN governance.agent_role_assignments ara ON ara.role_id = ro.id
  GROUP BY r.id, r.name, r.resource_type, r.sensitivity, r.location;

COMMENT ON VIEW governance.resource_exposure IS
  'Denormalized view of each resource with its data categories, active agent access count, and whether destructive actions are granted. Used to answer: "What is the access surface of each resource?"';

COMMIT;
