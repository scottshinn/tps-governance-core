-- Deploy schemas/governance/tables/compliance_requirements/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums
-- requires: schemas/governance/tables/compliance_frameworks/table

BEGIN;

CREATE TABLE governance.compliance_requirements (
  id             uuid                              PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id   uuid                              NOT NULL REFERENCES governance.compliance_frameworks(id) ON DELETE RESTRICT,
  reference_code text                              NOT NULL,
  description    text                              NOT NULL,
  status         governance.requirement_status     NOT NULL DEFAULT 'not_met',
  notes          text,
  created_at     timestamptz                       NOT NULL DEFAULT now(),
  updated_at     timestamptz                       NOT NULL DEFAULT now(),
  CONSTRAINT uq_compliance_requirements_framework_code UNIQUE (framework_id, reference_code)
);

COMMENT ON TABLE governance.compliance_requirements IS 'Specific requirements within a compliance framework. Each requirement maps to one or more governance rules that satisfy it.';
COMMENT ON COLUMN governance.compliance_requirements.reference_code IS 'Standard reference code for this requirement (e.g., "GDPR Art. 5(1)(f)", "CC6.1", "Article 10").';
COMMENT ON COLUMN governance.compliance_requirements.status IS 'Current satisfaction status — updated by Layer 2 analysis engine after rule evaluation.';

CREATE INDEX idx_compliance_requirements_framework_id ON governance.compliance_requirements (framework_id);
CREATE INDEX idx_compliance_requirements_status ON governance.compliance_requirements (status);

COMMIT;
