-- Deploy schemas/governance/tables/compliance_frameworks/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums

BEGIN;

CREATE TABLE governance.compliance_frameworks (
  id             uuid                         PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text                         NOT NULL,
  version        text,
  description    text,
  framework_type governance.framework_type    NOT NULL,
  effective_date date,
  review_date    date,
  source_url     text,
  created_at     timestamptz                  NOT NULL DEFAULT now(),
  updated_at     timestamptz                  NOT NULL DEFAULT now(),
  CONSTRAINT uq_compliance_frameworks_name_version UNIQUE (name, version)
);

COMMENT ON TABLE governance.compliance_frameworks IS 'External regulations, standards, and internal policies that mandate governance rules (GDPR, EU AI Act, SOC 2, etc.).';
COMMENT ON COLUMN governance.compliance_frameworks.version IS 'Version or year of the framework (e.g., "2024", "v1.0"). Used to track which revision of a standard is implemented.';
COMMENT ON COLUMN governance.compliance_frameworks.source_url IS 'Authoritative source URL for this framework.';

COMMIT;
