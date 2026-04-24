-- Deploy schemas/governance/tables/tool_resources/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums
-- requires: schemas/governance/tables/tools/table
-- requires: schemas/governance/tables/resources/table

BEGIN;

CREATE TABLE governance.tool_resources (
  tool_id      uuid                     NOT NULL REFERENCES governance.tools(id) ON DELETE CASCADE,
  resource_id  uuid                     NOT NULL REFERENCES governance.resources(id) ON DELETE CASCADE,
  -- actions: which action types this tool performs on this resource
  actions      governance.action_type[] NOT NULL,
  PRIMARY KEY (tool_id, resource_id),
  CONSTRAINT chk_tool_resources_actions CHECK (array_length(actions, 1) > 0)
);

COMMENT ON TABLE governance.tool_resources IS 'Many-to-many: which resources a tool reads from or writes to, and what actions it performs. Used by blast_radius() to trace transitive access.';
COMMENT ON COLUMN governance.tool_resources.actions IS 'Action types this tool performs on the resource when invoked.';

CREATE INDEX idx_tool_resources_resource_id ON governance.tool_resources (resource_id);
CREATE INDEX idx_tool_resources_actions ON governance.tool_resources USING GIN (actions);

COMMIT;
