-- Revert schemas/governance/tables/rule_sets/table from pg

BEGIN;

DROP TABLE governance.rule_sets;

COMMIT;
