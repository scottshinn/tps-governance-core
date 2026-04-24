-- Deploy schemas/governance/indexes/performance_indexes to pg

-- requires: schemas/governance/tables/agents/table
-- requires: schemas/governance/tables/permissions/table
-- requires: schemas/governance/tables/agent_role_assignments/table
-- requires: schemas/governance/tables/resource_data_categories/table
-- requires: schemas/governance/tables/audit_log/table
-- requires: schemas/governance/tables/rules/table
-- requires: schemas/governance/tables/sod_constraint_permissions/table

BEGIN;

-- Partial index: active non-expired role assignments (hot path for effective_permissions)
CREATE INDEX idx_agent_role_assignments_active_live
  ON governance.agent_role_assignments (agent_id, role_id)
  WHERE status = 'active' AND expires_at IS NULL;

-- Partial index: allow-type permissions (most queries filter on grant_type = 'allow')
CREATE INDEX idx_permissions_allow
  ON governance.permissions (role_id, resource_id)
  WHERE grant_type = 'allow';

-- Partial index: deny-type permissions (deny override check)
CREATE INDEX idx_permissions_deny
  ON governance.permissions (role_id, resource_id)
  WHERE grant_type = 'deny';

-- GIN index on permissions.actions for "find all permissions that include action X"
-- Already created per-table; this documents the intent for the index planner

-- Compound index for permission_overlap() — resolving resource access per agent
CREATE INDEX idx_permissions_resource_grant
  ON governance.permissions (resource_id, grant_type)
  INCLUDE (role_id, actions);

-- Index for blast_radius() — tool → resource lookup
CREATE INDEX idx_tool_resources_tool_id
  ON governance.tool_resources (tool_id)
  INCLUDE (resource_id, actions);

-- PII/sensitive resource lookup: "find all PII resources"
CREATE INDEX idx_resource_data_categories_pii
  ON governance.resource_data_categories (data_category, resource_id);

-- Audit log: range queries by time + entity for point-in-time reconstruction
CREATE INDEX idx_audit_log_entity_time
  ON governance.audit_log (entity_type, entity_id, occurred_at DESC);

-- Active governance rules (frequent filter in coverage and rule evaluation)
CREATE INDEX idx_rules_active
  ON governance.rules (scope, scope_entity_id)
  WHERE status = 'active';

-- SoD check: lookup permissions by constraint side
CREATE INDEX idx_sod_constraint_perms_lookup
  ON governance.sod_constraint_permissions (permission_id, constraint_id, side);

COMMIT;
