-- Deploy schemas/governance/functions/permission_overlap to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums
-- requires: schemas/governance/functions/effective_permissions
-- requires: schemas/governance/tables/agents/table

BEGIN;

CREATE FUNCTION governance.permission_overlap(p_resource_id uuid)
RETURNS TABLE (
  agent_id          uuid,
  agent_name        text,
  agent_type        governance.agent_type,
  lifecycle_state   governance.agent_lifecycle_state,
  effective_actions governance.action_type[],
  permission_count  bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    a.id              AS agent_id,
    a.name            AS agent_name,
    a.agent_type,
    a.lifecycle_state,
    array_agg(DISTINCT act ORDER BY act) AS effective_actions,
    count(DISTINCT ep.permission_id)     AS permission_count
  FROM governance.agents a
  CROSS JOIN LATERAL governance.effective_permissions(a.id) ep
  CROSS JOIN LATERAL unnest(ep.actions) AS act
  WHERE ep.resource_id = p_resource_id
    AND ep.grant_type = 'allow'
    AND a.lifecycle_state IN ('approved', 'active')
  GROUP BY a.id, a.name, a.agent_type, a.lifecycle_state
  ORDER BY a.name;
$$;

COMMENT ON FUNCTION governance.permission_overlap(uuid) IS
  'Returns all active/approved agents that have effective allow permissions on a specific resource, along with their effective action types. Used to detect overly broad access and answer: "Who else can read/write this resource?"';

COMMIT;
