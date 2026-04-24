-- Verify schemas/governance/tables/rule_sets/table on pg

BEGIN;

SELECT verify_table('governance.rule_sets');

ROLLBACK;
