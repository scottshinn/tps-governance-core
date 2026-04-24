-- Revert schemas/governance/tables/products/table from pg

BEGIN;

DROP TABLE governance.products;

COMMIT;
