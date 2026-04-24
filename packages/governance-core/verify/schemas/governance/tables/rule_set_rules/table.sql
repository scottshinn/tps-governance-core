-- Verify schemas/governance/tables/rule_set_rules/table on pg

BEGIN;

SELECT verify_table('governance.rule_set_rules');

ROLLBACK;
