-- Revert schemas/governance/tables/rule_compliance_reqs/table from pg

BEGIN;

DROP TABLE governance.rule_compliance_reqs;

COMMIT;
