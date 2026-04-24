-- Deploy schemas/governance/tables/mcp_servers/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums

BEGIN;

CREATE TABLE governance.mcp_servers (
  id               uuid                        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text                        NOT NULL,
  description      text,
  endpoint_url     text                        NOT NULL,
  status           governance.mcp_server_status NOT NULL DEFAULT 'active',
  auth_method      governance.mcp_auth_method  NOT NULL DEFAULT 'none',
  metadata         jsonb,
  created_at       timestamptz                 NOT NULL DEFAULT now(),
  updated_at       timestamptz                 NOT NULL DEFAULT now(),
  CONSTRAINT uq_mcp_servers_name UNIQUE (name)
);

COMMENT ON TABLE governance.mcp_servers IS 'Registered MCP (Model Context Protocol) server instances that expose tools to agents.';
COMMENT ON COLUMN governance.mcp_servers.endpoint_url IS 'Network endpoint at which this MCP server is reachable.';
COMMENT ON COLUMN governance.mcp_servers.auth_method IS 'Authentication method required to connect to this server.';
COMMENT ON COLUMN governance.mcp_servers.metadata IS 'Extensible key-value metadata: version, transport type, capability flags, etc.';

COMMIT;
