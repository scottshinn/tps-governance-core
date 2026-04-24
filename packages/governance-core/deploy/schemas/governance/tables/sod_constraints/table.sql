-- Deploy schemas/governance/tables/sod_constraints/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums
-- requires: schemas/governance/tables/compliance_requirements/table

BEGIN;

CREATE TABLE governance.sod_constraints (
  id                     uuid                           PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text                           NOT NULL,
  description            text,
  constraint_type        governance.sod_constraint_type NOT NULL,
  severity               governance.severity            NOT NULL DEFAULT 'high',
  is_active              boolean                        NOT NULL DEFAULT true,
  compliance_req_id      uuid                           REFERENCES governance.compliance_requirements(id) ON DELETE SET NULL,
  created_at             timestamptz                    NOT NULL DEFAULT now(),
  updated_at             timestamptz                    NOT NULL DEFAULT now(),
  CONSTRAINT uq_sod_constraints_name UNIQUE (name)
);

COMMENT ON TABLE governance.sod_constraints IS 'First-class declarations that certain permission combinations must not coexist. Defines the "two sides" that must be separated — populated via sod_constraint_permissions.';
COMMENT ON COLUMN governance.sod_constraints.constraint_type IS 'same_agent: no single agent may hold both sets; same_role: no single role; same_hierarchy: no agent chain root-to-leaf.';
COMMENT ON COLUMN governance.sod_constraints.compliance_req_id IS 'The compliance requirement that mandates this separation of duties. Enables traceability.';

CREATE INDEX idx_sod_constraints_active ON governance.sod_constraints (is_active);
CREATE INDEX idx_sod_constraints_severity ON governance.sod_constraints (severity);

COMMIT;
