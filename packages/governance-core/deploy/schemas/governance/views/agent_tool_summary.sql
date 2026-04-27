-- Deploy schemas/governance/views/agent_tool_summary to pg

-- requires: schemas/governance/functions/agent_tool_inventory
-- requires: schemas/governance/tables/agents/table

BEGIN;

CREATE VIEW governance.agent_tool_summary AS
  SELECT
    a.id                                                                  AS agent_id,
    a.name                                                                AS agent_name,
    a.agent_type,
    a.lifecycle_state,
    COUNT(DISTINCT ati.tool_id)                                           AS total_tools,
    COUNT(DISTINCT ati.tool_id) FILTER (WHERE ati.is_destructive = true)  AS destructive_tools,
    COUNT(DISTINCT ati.mcp_server_id) FILTER (WHERE ati.mcp_server_id IS NOT NULL) AS mcp_servers_used,
    array_agg(DISTINCT ati.tool_name ORDER BY ati.tool_name)
      FILTER (WHERE ati.tool_name IS NOT NULL)                            AS tool_names
  FROM governance.agents a
  LEFT JOIN LATERAL governance.agent_tool_inventory(a.id) ati ON true
  WHERE a.lifecycle_state IN ('approved', 'active')
  GROUP BY a.id, a.name, a.agent_type, a.lifecycle_state
  ORDER BY a.name;

COMMENT ON VIEW governance.agent_tool_summary IS
  'Dashboard companion to agent_tool_inventory(). Shows all approved/active agents with their tool counts, destructive tool count, distinct MCP server count, and full tool name list. Intended for the KYA control plane agent list view and Layer 2 risk aggregation.';

COMMIT;
