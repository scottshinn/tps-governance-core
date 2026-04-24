-- Deploy schemas/governance/tables/tools/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums
-- requires: schemas/governance/tables/mcp_servers/table

BEGIN;

CREATE TABLE governance.tools (
  id               uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text                   NOT NULL,
  description      text,
  tool_type        governance.tool_type   NOT NULL,
  mcp_server_id    uuid                   REFERENCES governance.mcp_servers(id) ON DELETE RESTRICT,
  -- parameters: JSON Schema describing accepted input parameters
  parameters       jsonb,
  -- risk_profile: worst-case impact description if this tool is used without restriction
  risk_profile     text,
  is_idempotent    boolean                NOT NULL DEFAULT false,
  is_destructive   boolean                NOT NULL DEFAULT false,
  metadata         jsonb,
  created_at       timestamptz            NOT NULL DEFAULT now(),
  updated_at       timestamptz            NOT NULL DEFAULT now(),
  CONSTRAINT uq_tools_name_server UNIQUE (name, mcp_server_id),
  -- MCP tools must reference an MCP server; non-MCP tools must not
  CONSTRAINT chk_tools_mcp_server CHECK (
    (tool_type = 'mcp_tool' AND mcp_server_id IS NOT NULL)
    OR (tool_type != 'mcp_tool')
  )
);

COMMENT ON TABLE governance.tools IS 'Specific capabilities exposed through MCP or other interfaces. Tools are the enforcement boundary — agents access resources through tools.';
COMMENT ON COLUMN governance.tools.mcp_server_id IS 'MCP server that exposes this tool. Required when tool_type = mcp_tool.';
COMMENT ON COLUMN governance.tools.parameters IS 'JSON Schema of accepted input parameters. Used by Layer 2 for permission condition validation.';
COMMENT ON COLUMN governance.tools.risk_profile IS 'Narrative description of worst-case impact if this tool is used without access controls.';
COMMENT ON COLUMN governance.tools.is_idempotent IS 'True if repeated calls produce the same result — safe to retry without governance concern.';
COMMENT ON COLUMN governance.tools.is_destructive IS 'True if calls cannot be undone (file deletion, record purge, etc.) — triggers stricter governance rules.';

CREATE INDEX idx_tools_mcp_server_id ON governance.tools (mcp_server_id);
CREATE INDEX idx_tools_tool_type ON governance.tools (tool_type);
CREATE INDEX idx_tools_is_destructive ON governance.tools (is_destructive) WHERE is_destructive = true;

COMMIT;
