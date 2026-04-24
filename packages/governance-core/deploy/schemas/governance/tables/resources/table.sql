-- Deploy schemas/governance/tables/resources/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums
-- requires: schemas/governance/tables/products/table

BEGIN;

CREATE TABLE governance.resources (
  id                    uuid                                PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text                                NOT NULL,
  description           text,
  resource_type         governance.resource_type            NOT NULL,
  sensitivity           governance.sensitivity_classification NOT NULL DEFAULT 'internal',
  -- supported_actions: which action types are meaningful for this resource
  supported_actions     governance.action_type[]            NOT NULL DEFAULT '{}',
  location              text,
  owner                 text,
  product_id            uuid                                REFERENCES governance.products(id) ON DELETE RESTRICT,
  metadata              jsonb,
  created_at            timestamptz                         NOT NULL DEFAULT now(),
  updated_at            timestamptz                         NOT NULL DEFAULT now(),
  CONSTRAINT uq_resources_name_type UNIQUE (name, resource_type),
  CONSTRAINT chk_resources_supported_actions CHECK (array_length(supported_actions, 1) > 0)
);

COMMENT ON TABLE governance.resources IS 'Anything an agent can interact with — databases, APIs, files, queues, MCP servers, external services. The I/O surface of a deployment.';
COMMENT ON COLUMN governance.resources.resource_type IS 'Structural category of this resource.';
COMMENT ON COLUMN governance.resources.sensitivity IS 'Data sensitivity classification — governs which agents/roles may access this resource.';
COMMENT ON COLUMN governance.resources.supported_actions IS 'Which action types are semantically valid for this resource (e.g., a webhook supports execute but not read).';
COMMENT ON COLUMN governance.resources.location IS 'URI, connection string, or path identifying this resource. May contain sensitive endpoint information.';

CREATE INDEX idx_resources_resource_type ON governance.resources (resource_type);
CREATE INDEX idx_resources_sensitivity ON governance.resources (sensitivity);
CREATE INDEX idx_resources_product_id ON governance.resources (product_id);
CREATE INDEX idx_resources_supported_actions ON governance.resources USING GIN (supported_actions);

COMMIT;
