-- Deploy schemas/governance/functions/coverage_gaps to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/tables/resources/table
-- requires: schemas/governance/tables/permissions/table
-- requires: schemas/governance/tables/rules/table

BEGIN;

CREATE FUNCTION governance.coverage_gaps()
RETURNS TABLE (
  resource_id    uuid,
  resource_name  text,
  resource_type  governance.resource_type,
  sensitivity    governance.sensitivity_classification,
  has_permission boolean,
  has_rule       boolean
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    r.id            AS resource_id,
    r.name          AS resource_name,
    r.resource_type,
    r.sensitivity,
    EXISTS (
      SELECT 1 FROM governance.permissions p
      WHERE p.resource_id = r.id
        AND (p.expires_at IS NULL OR p.expires_at > now())
    ) AS has_permission,
    EXISTS (
      SELECT 1 FROM governance.rules rl
      WHERE rl.scope = 'resource'
        AND rl.scope_entity_id = r.id
        AND rl.status = 'active'
    ) AS has_rule
  FROM governance.resources r
  WHERE NOT EXISTS (
      -- Has at least one active non-expired permission
      SELECT 1 FROM governance.permissions p
      WHERE p.resource_id = r.id
        AND (p.expires_at IS NULL OR p.expires_at > now())
    )
    OR NOT EXISTS (
      -- Has at least one active resource-scoped rule
      SELECT 1 FROM governance.rules rl
      WHERE rl.scope = 'resource'
        AND rl.scope_entity_id = r.id
        AND rl.status = 'active'
    )
  ORDER BY r.sensitivity DESC, r.resource_type, r.name;
$$;

COMMENT ON FUNCTION governance.coverage_gaps() IS
  'Returns resources that lack governance coverage: either no active permissions reference them (unaccessed but still a gap if they should be controlled) or no active resource-scoped rules govern them. Results ordered by sensitivity descending so the highest-risk gaps surface first. Used to answer: "Which resources have no governance rules attached?"';

COMMIT;
