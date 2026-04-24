-- Deploy schemas/governance/tables/products/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums

BEGIN;

CREATE TABLE governance.products (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  owner       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_products_name UNIQUE (name)
);

COMMENT ON TABLE governance.products IS 'Logical groupings of agents, resources, and rules by product or service deployment.';
COMMENT ON COLUMN governance.products.id IS 'Unique identifier for this product.';
COMMENT ON COLUMN governance.products.name IS 'Human-readable product name, unique across the system.';
COMMENT ON COLUMN governance.products.owner IS 'Team or individual responsible for this product.';

COMMIT;
