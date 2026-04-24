-- Deploy schemas/governance/tables/agent_role_assignments/table to pg

-- requires: schemas/governance/schema
-- requires: schemas/governance/types/enums
-- requires: schemas/governance/tables/agents/table
-- requires: schemas/governance/tables/roles/table

BEGIN;

CREATE TABLE governance.agent_role_assignments (
  id           uuid                          PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     uuid                          NOT NULL REFERENCES governance.agents(id) ON DELETE RESTRICT,
  role_id      uuid                          NOT NULL REFERENCES governance.roles(id) ON DELETE RESTRICT,
  assigned_by  text                          NOT NULL,
  reason       text,
  status       governance.assignment_status  NOT NULL DEFAULT 'active',
  expires_at   timestamptz,
  created_at   timestamptz                   NOT NULL DEFAULT now(),
  updated_at   timestamptz                   NOT NULL DEFAULT now(),
  -- only one active assignment per agent+role at a time
  CONSTRAINT uq_agent_role_assignments_active UNIQUE (agent_id, role_id)
);

COMMENT ON TABLE governance.agent_role_assignments IS 'Binds agents to roles. Every permission an agent holds flows through this table via role membership.';
COMMENT ON COLUMN governance.agent_role_assignments.assigned_by IS 'Identity of the human or system that created this assignment. Used in audit queries.';
COMMENT ON COLUMN governance.agent_role_assignments.reason IS 'Justification for why this agent was assigned this role.';
COMMENT ON COLUMN governance.agent_role_assignments.status IS 'active = in effect; suspended = temporarily inactive; expired = past expires_at; revoked = manually terminated.';
COMMENT ON COLUMN governance.agent_role_assignments.expires_at IS 'When set, the assignment automatically becomes ineffective after this timestamp.';

CREATE INDEX idx_agent_role_assignments_agent_id ON governance.agent_role_assignments (agent_id);
CREATE INDEX idx_agent_role_assignments_role_id ON governance.agent_role_assignments (role_id);
CREATE INDEX idx_agent_role_assignments_status ON governance.agent_role_assignments (status);
CREATE INDEX idx_agent_role_assignments_expires_at ON governance.agent_role_assignments (expires_at) WHERE expires_at IS NOT NULL;

COMMIT;
