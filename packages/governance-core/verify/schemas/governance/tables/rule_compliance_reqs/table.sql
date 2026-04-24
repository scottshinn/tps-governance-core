-- Verify schemas/governance/tables/rule_compliance_reqs/table on pg

BEGIN;

SELECT verify_table('governance.rule_compliance_reqs');

ROLLBACK;
