-- Revert schemas/governance/tables/resource_data_categories/table from pg

BEGIN;

DROP TABLE governance.resource_data_categories;

COMMIT;
