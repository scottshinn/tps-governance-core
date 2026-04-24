-- Deploy schemas/governance/tables/roles/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums

BEGIN;

CREATE TABLE governance.roles (
  id                    uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text                    NOT NULL,
  description           text,
  parent_role_id        uuid                    REFERENCES governance.roles(id) ON DELETE RESTRICT,
  scope                 governance.scope_level  NOT NULL DEFAULT 'global',
  is_built_in           boolean                 NOT NULL DEFAULT false,
  -- max_assignments: optional hard cap on how many agents may hold this role simultaneously
  max_assignments       integer                 CHECK (max_assignments > 0),
  created_at            timestamptz             NOT NULL DEFAULT now(),
  updated_at            timestamptz             NOT NULL DEFAULT now(),
  CONSTRAINT uq_roles_name UNIQUE (name)
);

COMMENT ON TABLE governance.roles IS 'Named collections of permissions. Roles form a hierarchy via parent_role_id — a child role inherits all permissions of its ancestors.';
COMMENT ON COLUMN governance.roles.parent_role_id IS 'Parent role whose permissions are inherited by this role. NULL for root roles.';
COMMENT ON COLUMN governance.roles.scope IS 'At what level this role applies: global = system-wide, product = one deployment, agent = single agent.';
COMMENT ON COLUMN governance.roles.is_built_in IS 'True for system-defined roles (system_admin, auditor, etc.) that cannot be deleted.';
COMMENT ON COLUMN governance.roles.max_assignments IS 'Optional cap on concurrent active assignments. Enforced at assignment creation time by application/trigger logic.';

CREATE INDEX idx_roles_parent_role_id ON governance.roles (parent_role_id);
CREATE INDEX idx_roles_scope ON governance.roles (scope);

COMMIT;
