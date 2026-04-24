-- Deploy schemas/governance/tables/sod_constraint_permissions/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/tables/sod_constraints/table
-- requires: schemas/governance/tables/permissions/table

BEGIN;

CREATE TABLE governance.sod_constraint_permissions (
  constraint_id  uuid NOT NULL REFERENCES governance.sod_constraints(id) ON DELETE CASCADE,
  permission_id  uuid NOT NULL REFERENCES governance.permissions(id) ON DELETE CASCADE,
  -- side: 'a' or 'b' — which side of the conflict this permission belongs to
  side           text NOT NULL CHECK (side IN ('a', 'b')),
  PRIMARY KEY (constraint_id, permission_id, side)
);

COMMENT ON TABLE governance.sod_constraint_permissions IS 'Maps permissions to the two sides (a, b) of a SoD constraint. A violation occurs when an agent simultaneously holds permissions from both sides.';
COMMENT ON COLUMN governance.sod_constraint_permissions.side IS '"a" or "b" — the conflict side. Holding any permission from set A AND any from set B on the same entity triggers the SoD constraint.';

CREATE INDEX idx_sod_constraint_permissions_permission_id ON governance.sod_constraint_permissions (permission_id);
CREATE INDEX idx_sod_constraint_permissions_constraint_side ON governance.sod_constraint_permissions (constraint_id, side);

COMMIT;
