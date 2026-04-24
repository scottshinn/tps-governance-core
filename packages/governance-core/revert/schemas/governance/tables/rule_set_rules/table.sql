-- Revert schemas/governance/tables/rule_set_rules/table from pg

BEGIN;

DROP TABLE governance.rule_set_rules;

COMMIT;
