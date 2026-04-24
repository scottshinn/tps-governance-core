-- Deploy schemas/governance/tables/rule_set_rules/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/tables/rule_sets/table
-- requires: schemas/governance/tables/rules/table

BEGIN;

CREATE TABLE governance.rule_set_rules (
  rule_set_id  uuid NOT NULL REFERENCES governance.rule_sets(id) ON DELETE CASCADE,
  rule_id      uuid NOT NULL REFERENCES governance.rules(id) ON DELETE CASCADE,
  PRIMARY KEY (rule_set_id, rule_id)
);

COMMENT ON TABLE governance.rule_set_rules IS 'Many-to-many: which rules belong to which rule sets. A rule may appear in multiple rule sets.';

CREATE INDEX idx_rule_set_rules_rule_id ON governance.rule_set_rules (rule_id);

COMMIT;
