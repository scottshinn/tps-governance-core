-- Deploy schemas/governance/functions/blast_radius to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums
-- requires: schemas/governance/functions/effective_permissions
-- requires: schemas/governance/tables/tool_resources/table
-- requires: schemas/governance/tables/resources/table

BEGIN;

CREATE FUNCTION governance.blast_radius(p_agent_id uuid)
RETURNS TABLE (
  resource_id       uuid,
  resource_name     text,
  resource_type     governance.resource_type,
  sensitivity       governance.sensitivity_classification,
  effective_actions governance.action_type[],
  access_paths      text[]
)
LANGUAGE sql
STABLE
AS $$
  WITH agent_perms AS (
    SELECT
      ep.resource_id,
      ep.tool_id,
      ep.actions
    FROM governance.effective_permissions(p_agent_id) ep
    WHERE ep.grant_type = 'allow'
  ),
  -- Resources directly referenced in allow permissions
  direct_access AS (
    SELECT
      ap.resource_id,
      ap.actions,
      ARRAY['direct_permission'] AS access_paths
    FROM agent_perms ap
    WHERE ap.resource_id IS NOT NULL
  ),
  -- Resources reachable via tools that the agent has execute/use permissions for
  tool_access AS (
    SELECT
      tr.resource_id,
      tr.actions,
      ARRAY['via_tool:' || t.name] AS access_paths
    FROM agent_perms ap
    JOIN governance.tool_resources tr ON tr.tool_id = ap.tool_id
    JOIN governance.tools t ON t.id = ap.tool_id
    WHERE ap.tool_id IS NOT NULL
  ),
  combined AS (
    SELECT resource_id, unnest(actions) AS action, unnest(access_paths) AS path
    FROM direct_access
    UNION ALL
    SELECT resource_id, unnest(actions) AS action, unnest(access_paths) AS path
    FROM tool_access
  )
  SELECT
    r.id                  AS resource_id,
    r.name                AS resource_name,
    r.resource_type,
    r.sensitivity,
    array_agg(DISTINCT c.action ORDER BY c.action)  AS effective_actions,
    array_agg(DISTINCT c.path  ORDER BY c.path)     AS access_paths
  FROM combined c
  JOIN governance.resources r ON r.id = c.resource_id
  GROUP BY r.id, r.name, r.resource_type, r.sensitivity
  ORDER BY r.sensitivity DESC, r.name;
$$;

COMMENT ON FUNCTION governance.blast_radius(uuid) IS
  'Computes the full resource exposure for an agent: all resources it can directly access via permissions, plus all resources reachable via tools it has permissions to use. Returns deduplicated results with the union of all effective actions and the access paths. Ordered by sensitivity descending (most sensitive first). Used to answer: "If this agent is compromised, what can an attacker reach?"';

COMMIT;
