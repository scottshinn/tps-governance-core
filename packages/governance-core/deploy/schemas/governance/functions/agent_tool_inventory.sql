-- Deploy schemas/governance/functions/agent_tool_inventory to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums
-- requires: schemas/governance/functions/effective_permissions
-- requires: schemas/governance/tables/tools/table
-- requires: schemas/governance/tables/mcp_servers/table
-- requires: schemas/governance/tables/tool_resources/table
-- requires: schemas/governance/tables/agent_role_assignments/table

BEGIN;

CREATE FUNCTION governance.agent_tool_inventory(p_agent_id uuid)
RETURNS TABLE (
  tool_id                uuid,
  tool_name              text,
  tool_type              governance.tool_type,
  mcp_server_id          uuid,
  mcp_server_name        text,
  is_destructive         boolean,
  is_idempotent          boolean,
  resource_count         bigint,
  effective_actions      governance.action_type[],
  granted_via_role_name  text,
  granted_via_role_depth integer
)
LANGUAGE sql
STABLE
AS $$
  WITH allow_perms AS (
    -- All allow grants with a non-null tool_id
    SELECT
      ep.tool_id,
      ep.actions,
      ep.role_name,
      ep.role_depth
    FROM governance.effective_permissions(p_agent_id) ep
    WHERE ep.grant_type = 'allow'
      AND ep.tool_id IS NOT NULL
  ),
  -- For each tool, pick the shallowest (most direct) granting role
  direct_grant AS (
    SELECT DISTINCT ON (ap.tool_id)
      ap.tool_id,
      ap.role_name  AS granted_via_role_name,
      ap.role_depth AS granted_via_role_depth
    FROM allow_perms ap
    ORDER BY ap.tool_id, ap.role_depth ASC
  ),
  -- Aggregate effective actions per tool across all granting permissions
  tool_actions AS (
    SELECT
      ap.tool_id,
      array_agg(DISTINCT act ORDER BY act) AS effective_actions
    FROM allow_perms ap
    CROSS JOIN LATERAL unnest(ap.actions) AS act
    GROUP BY ap.tool_id
  )
  SELECT
    t.id                             AS tool_id,
    t.name                           AS tool_name,
    t.tool_type,
    t.mcp_server_id,
    ms.name                          AS mcp_server_name,
    t.is_destructive,
    t.is_idempotent,
    COUNT(DISTINCT tr.resource_id)   AS resource_count,
    ta.effective_actions,
    dg.granted_via_role_name,
    dg.granted_via_role_depth
  FROM direct_grant dg
  JOIN governance.tools t ON t.id = dg.tool_id
  LEFT JOIN governance.mcp_servers ms ON ms.id = t.mcp_server_id
  LEFT JOIN governance.tool_resources tr ON tr.tool_id = t.id
  JOIN tool_actions ta ON ta.tool_id = t.id
  GROUP BY
    t.id, t.name, t.tool_type, t.mcp_server_id, ms.name,
    t.is_destructive, t.is_idempotent,
    ta.effective_actions, dg.granted_via_role_name, dg.granted_via_role_depth
  ORDER BY t.name;
$$;

COMMENT ON FUNCTION governance.agent_tool_inventory(uuid) IS
  'Returns all tools an agent can use, resolved through the role hierarchy. Only allow grants are included — tools blocked by deny grants are not shown. For each tool: metadata (type, destructive/idempotent flags), the count of resources it can reach, the union of all effective actions granted across all permissions referencing the tool, and the most direct role that granted access (shallowest depth). Designed as the primary data source for the KYA control plane hover-over-agent display.';

COMMIT;
