-- Deploy schemas/governance/tables/resource_data_categories/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums
-- requires: schemas/governance/tables/resources/table

BEGIN;

CREATE TABLE governance.resource_data_categories (
  resource_id    uuid                     NOT NULL REFERENCES governance.resources(id) ON DELETE CASCADE,
  data_category  governance.data_category NOT NULL,
  PRIMARY KEY (resource_id, data_category)
);

COMMENT ON TABLE governance.resource_data_categories IS 'Many-to-many: which data categories are present in or flow through a resource. Enables queries like "which agents can access PII?"';
COMMENT ON COLUMN governance.resource_data_categories.data_category IS 'Category of sensitive data present in this resource.';

CREATE INDEX idx_resource_data_categories_category ON governance.resource_data_categories (data_category);

COMMIT;
