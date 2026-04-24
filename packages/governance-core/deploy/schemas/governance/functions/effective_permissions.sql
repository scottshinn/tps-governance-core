-- Deploy schemas/governance/functions/effective_permissions to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums
-- requires: schemas/governance/tables/agents/table
-- requires: schemas/governance/tables/roles/table
-- requires: schemas/governance/tables/permissions/table
-- requires: schemas/governance/tables/agent_role_assignments/table

BEGIN;

CREATE FUNCTION governance.effective_permissions(p_agent_id uuid)
RETURNS TABLE (
  permission_id  uuid,
  role_id        uuid,
  role_name      text,
  role_depth     integer,
  resource_id    uuid,
  tool_id        uuid,
  actions        governance.action_type[],
  conditions     jsonb,
  grant_type     governance.grant_type,
  expires_at     timestamptz
)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE role_hierarchy AS (
    -- Direct role assignments for this agent (active and not expired)
    SELECT
      ara.role_id,
      r.name AS role_name,
      r.parent_role_id,
      0 AS depth
    FROM governance.agent_role_assignments ara
    JOIN governance.roles r ON r.id = ara.role_id
    WHERE ara.agent_id = p_agent_id
      AND ara.status = 'active'
      AND (ara.expires_at IS NULL OR ara.expires_at > now())

    UNION ALL

    -- Inherited roles via role parent chain (depth-limited to prevent cycles)
    SELECT
      r.id AS role_id,
      r.name AS role_name,
      r.parent_role_id,
      rh.depth + 1
    FROM governance.roles r
    JOIN role_hierarchy rh ON r.id = rh.parent_role_id
    WHERE rh.depth < 20  -- ASSUMPTION: role hierarchy max depth = 20
  )
  SELECT DISTINCT ON (p.id)
    p.id          AS permission_id,
    rh.role_id,
    rh.role_name,
    rh.depth      AS role_depth,
    p.resource_id,
    p.tool_id,
    p.actions,
    p.conditions,
    p.grant_type,
    p.expires_at
  FROM role_hierarchy rh
  JOIN governance.permissions p ON p.role_id = rh.role_id
  WHERE (p.expires_at IS NULL OR p.expires_at > now())
  ORDER BY p.id, rh.depth ASC;  -- prefer the most direct role when deduplicating
$$;

COMMENT ON FUNCTION governance.effective_permissions(uuid) IS
  'Returns the full set of permissions for an agent, resolved through the role hierarchy. Includes inherited permissions from parent roles up to 20 levels deep. Both allow and deny grants are returned — callers must check grant_type. Active assignments only; expired permissions are excluded.';

COMMIT;
