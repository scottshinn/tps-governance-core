-- Deploy schemas/governance/functions/sod_check to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums
-- requires: schemas/governance/functions/effective_permissions
-- requires: schemas/governance/tables/sod_constraints/table
-- requires: schemas/governance/tables/sod_constraint_permissions/table

BEGIN;

CREATE FUNCTION governance.sod_check(p_agent_id uuid)
RETURNS TABLE (
  constraint_id    uuid,
  constraint_name  text,
  constraint_type  governance.sod_constraint_type,
  severity         governance.severity,
  side_a_perm_ids  uuid[],
  side_b_perm_ids  uuid[]
)
LANGUAGE sql
STABLE
AS $$
  WITH agent_allow_perms AS (
    -- All effective allow permissions for this agent
    SELECT ep.permission_id
    FROM governance.effective_permissions(p_agent_id) ep
    WHERE ep.grant_type = 'allow'
  ),
  violated_constraints AS (
    -- Find constraints where the agent holds at least one permission from each side
    SELECT
      sc.id         AS constraint_id,
      sc.name       AS constraint_name,
      sc.constraint_type,
      sc.severity,
      array_agg(DISTINCT scp.permission_id) FILTER (WHERE scp.side = 'a') AS side_a_perm_ids,
      array_agg(DISTINCT scp.permission_id) FILTER (WHERE scp.side = 'b') AS side_b_perm_ids
    FROM governance.sod_constraints sc
    JOIN governance.sod_constraint_permissions scp ON scp.constraint_id = sc.id
    JOIN agent_allow_perms aap ON aap.permission_id = scp.permission_id
    WHERE sc.is_active = true
    GROUP BY sc.id, sc.name, sc.constraint_type, sc.severity
  )
  SELECT *
  FROM violated_constraints
  -- Only return if agent holds permissions from BOTH sides
  WHERE side_a_perm_ids IS NOT NULL
    AND side_b_perm_ids IS NOT NULL;
$$;

COMMENT ON FUNCTION governance.sod_check(uuid) IS
  'Checks an agent for Segregation of Duties violations. Returns one row per violated SoD constraint, with the specific permission IDs from each conflicting side. Only considers active allow permissions; expired or denied permissions are excluded.';

COMMIT;
