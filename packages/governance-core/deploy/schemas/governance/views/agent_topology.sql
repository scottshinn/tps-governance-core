-- Deploy schemas/governance/views/agent_topology to pg

-- requires: schemas/governance/tables/agents/table

BEGIN;

CREATE VIEW governance.agent_topology AS
  WITH RECURSIVE hierarchy AS (
    -- Root agents (no parent)
    SELECT
      id,
      name,
      parent_agent_id,
      agent_type,
      lifecycle_state,
      product_id,
      0             AS depth,
      ARRAY[id]     AS path,
      name::text    AS full_path
    FROM governance.agents
    WHERE parent_agent_id IS NULL

    UNION ALL

    -- Child agents
    SELECT
      a.id,
      a.name,
      a.parent_agent_id,
      a.agent_type,
      a.lifecycle_state,
      a.product_id,
      h.depth + 1,
      h.path || a.id,
      h.full_path || ' > ' || a.name
    FROM governance.agents a
    JOIN hierarchy h ON a.parent_agent_id = h.id
    WHERE NOT (a.id = ANY(h.path))  -- cycle guard
      AND h.depth < 20
  )
  SELECT
    id,
    name,
    parent_agent_id,
    agent_type,
    lifecycle_state,
    product_id,
    depth,
    path      AS ancestor_ids,
    full_path AS display_path
  FROM hierarchy;

COMMENT ON VIEW governance.agent_topology IS
  'Recursive view of the full agent hierarchy, showing each agent with its depth, ancestor chain, and human-readable display path. Useful for visualizing orchestrator → sub-agent delegation trees.';

COMMIT;
