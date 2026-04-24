-- Deploy schemas/governance/tables/permissions/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums
-- requires: schemas/governance/tables/roles/table
-- requires: schemas/governance/tables/resources/table
-- requires: schemas/governance/tables/tools/table

BEGIN;

CREATE TABLE governance.permissions (
  id           uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id      uuid                    NOT NULL REFERENCES governance.roles(id) ON DELETE RESTRICT,
  resource_id  uuid                    NOT NULL REFERENCES governance.resources(id) ON DELETE RESTRICT,
  -- tool_id: when non-null, this permission only applies when the resource is accessed via this specific tool
  tool_id      uuid                    REFERENCES governance.tools(id) ON DELETE RESTRICT,
  actions      governance.action_type[] NOT NULL,
  -- conditions: ABAC-style conditions (time windows, IP ranges, tenant scopes, rate limits, approval thresholds)
  conditions   jsonb,
  grant_type   governance.grant_type   NOT NULL DEFAULT 'allow',
  expires_at   timestamptz,
  created_at   timestamptz             NOT NULL DEFAULT now(),
  updated_at   timestamptz             NOT NULL DEFAULT now(),
  CONSTRAINT uq_permissions_role_resource_tool UNIQUE (role_id, resource_id, tool_id, grant_type),
  CONSTRAINT chk_permissions_actions CHECK (array_length(actions, 1) > 0)
);

COMMENT ON TABLE governance.permissions IS 'The link between roles and what they are allowed to do. A permission grants specific actions on a resource, optionally scoped to a particular tool.';
COMMENT ON COLUMN governance.permissions.tool_id IS 'When set, this permission only applies when the resource is accessed through this specific tool. NULL = any tool may be used.';
COMMENT ON COLUMN governance.permissions.actions IS 'Array of permitted action types. Must be non-empty.';
COMMENT ON COLUMN governance.permissions.conditions IS 'Optional ABAC conditions as JSON: {"time_window": {...}, "ip_ranges": [...], "requires_approval_above_threshold": 5000}.';
COMMENT ON COLUMN governance.permissions.grant_type IS 'allow = grant access; deny = explicitly block access. Explicit deny overrides any allow on the same resource/action.';
COMMENT ON COLUMN governance.permissions.expires_at IS 'When set, this permission is automatically inactive after this timestamp.';

CREATE INDEX idx_permissions_role_id ON governance.permissions (role_id);
CREATE INDEX idx_permissions_resource_id ON governance.permissions (resource_id);
CREATE INDEX idx_permissions_tool_id ON governance.permissions (tool_id);
CREATE INDEX idx_permissions_grant_type ON governance.permissions (grant_type);
CREATE INDEX idx_permissions_expires_at ON governance.permissions (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_permissions_actions ON governance.permissions USING GIN (actions);

COMMIT;
