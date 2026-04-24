-- Deploy schemas/governance/tables/rule_compliance_reqs/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/tables/rules/table
-- requires: schemas/governance/tables/compliance_requirements/table

BEGIN;

CREATE TABLE governance.rule_compliance_reqs (
  rule_id        uuid NOT NULL REFERENCES governance.rules(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES governance.compliance_requirements(id) ON DELETE CASCADE,
  PRIMARY KEY (rule_id, requirement_id)
);

COMMENT ON TABLE governance.rule_compliance_reqs IS 'Many-to-many: which compliance requirements a rule satisfies. Enables traceability queries ("show all rules satisfying GDPR Art. 5").';

CREATE INDEX idx_rule_compliance_reqs_requirement_id ON governance.rule_compliance_reqs (requirement_id);

COMMIT;
