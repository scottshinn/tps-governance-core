-- Deploy schemas/governance/tables/risk_assessments/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums

BEGIN;

CREATE TABLE governance.risk_assessments (
  id                uuid                          PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       text                          NOT NULL,
  entity_id         uuid                          NOT NULL,
  risk_level        governance.risk_level         NOT NULL,
  -- risk_score: numeric 1-5 (1=negligible, 5=critical) for aggregation and sorting
  risk_score        integer                       NOT NULL CHECK (risk_score BETWEEN 1 AND 5),
  -- risk_factors: array of contributing factor objects
  risk_factors      jsonb                         NOT NULL DEFAULT '[]',
  assessment_method governance.assessment_method  NOT NULL,
  assessor          text,
  notes             text,
  assessed_at       timestamptz                   NOT NULL DEFAULT now(),
  -- valid_until: when this assessment expires and must be re-evaluated
  valid_until       timestamptz,
  created_at        timestamptz                   NOT NULL DEFAULT now()
);

COMMENT ON TABLE governance.risk_assessments IS 'Point-in-time risk scores for agents, roles, or permission sets. Multiple assessments per entity track score changes over time.';
COMMENT ON COLUMN governance.risk_assessments.entity_type IS 'Type of entity assessed: "governance.agents", "governance.roles", "governance.permissions", etc.';
COMMENT ON COLUMN governance.risk_assessments.entity_id IS 'UUID of the assessed entity. Not a FK — polymorphic reference to avoid cross-table constraints.';
COMMENT ON COLUMN governance.risk_assessments.risk_score IS 'Numeric 1–5 (1=negligible, 2=low, 3=moderate, 4=high, 5=critical). Use risk_level for the qualitative label.';
COMMENT ON COLUMN governance.risk_assessments.risk_factors IS 'Array of contributing factors: [{"factor": "has_delete_on_pii", "weight": 2, "description": "..."}].';
COMMENT ON COLUMN governance.risk_assessments.valid_until IS 'When non-null, this assessment should be re-evaluated after this timestamp.';

CREATE INDEX idx_risk_assessments_entity ON governance.risk_assessments (entity_type, entity_id);
CREATE INDEX idx_risk_assessments_risk_score ON governance.risk_assessments (risk_score DESC);
CREATE INDEX idx_risk_assessments_assessed_at ON governance.risk_assessments (assessed_at DESC);

COMMIT;
