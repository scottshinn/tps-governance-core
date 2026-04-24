-- Deploy schemas/governance/functions/attach_audit_triggers to pg

-- requires: schemas/governance_private/functions/audit_trigger
-- requires: schemas/governance/tables/agents/table
-- requires: schemas/governance/tables/resources/table
-- requires: schemas/governance/tables/tools/table
-- requires: schemas/governance/tables/roles/table
-- requires: schemas/governance/tables/permissions/table
-- requires: schemas/governance/tables/agent_role_assignments/table
-- requires: schemas/governance/tables/compliance_frameworks/table
-- requires: schemas/governance/tables/compliance_requirements/table
-- requires: schemas/governance/tables/rules/table
-- requires: schemas/governance/tables/rule_sets/table
-- requires: schemas/governance/tables/sod_constraints/table
-- requires: schemas/governance/tables/mcp_servers/table
-- requires: schemas/governance/tables/products/table
-- requires: schemas/governance/tables/risk_assessments/table

BEGIN;

-- agents
CREATE TRIGGER tg_audit_agents
  AFTER INSERT OR UPDATE OR DELETE ON governance.agents
  FOR EACH ROW EXECUTE FUNCTION governance_private.tg_audit_log(
    'agent_registered', 'agent_updated', 'agent_decommissioned'
  );

-- resources
CREATE TRIGGER tg_audit_resources
  AFTER INSERT OR UPDATE OR DELETE ON governance.resources
  FOR EACH ROW EXECUTE FUNCTION governance_private.tg_audit_log(
    'resource_registered', 'resource_updated', 'resource_updated'
  );

-- tools
CREATE TRIGGER tg_audit_tools
  AFTER INSERT OR UPDATE OR DELETE ON governance.tools
  FOR EACH ROW EXECUTE FUNCTION governance_private.tg_audit_log(
    'tool_registered', 'tool_updated', 'tool_updated'
  );

-- roles
CREATE TRIGGER tg_audit_roles
  AFTER INSERT OR UPDATE OR DELETE ON governance.roles
  FOR EACH ROW EXECUTE FUNCTION governance_private.tg_audit_log(
    'role_created', 'role_updated', 'role_deleted'
  );

-- permissions
CREATE TRIGGER tg_audit_permissions
  AFTER INSERT OR UPDATE OR DELETE ON governance.permissions
  FOR EACH ROW EXECUTE FUNCTION governance_private.tg_audit_log(
    'permission_granted', 'permission_updated', 'permission_revoked'
  );

-- agent_role_assignments
CREATE TRIGGER tg_audit_agent_role_assignments
  AFTER INSERT OR UPDATE OR DELETE ON governance.agent_role_assignments
  FOR EACH ROW EXECUTE FUNCTION governance_private.tg_audit_log(
    'assignment_created', 'assignment_revoked', 'assignment_revoked'
  );

-- compliance_frameworks
CREATE TRIGGER tg_audit_compliance_frameworks
  AFTER INSERT OR UPDATE OR DELETE ON governance.compliance_frameworks
  FOR EACH ROW EXECUTE FUNCTION governance_private.tg_audit_log(
    'compliance_framework_added', 'compliance_framework_added', NULL
  );

-- compliance_requirements
CREATE TRIGGER tg_audit_compliance_requirements
  AFTER INSERT OR UPDATE OR DELETE ON governance.compliance_requirements
  FOR EACH ROW EXECUTE FUNCTION governance_private.tg_audit_log(
    'compliance_requirement_updated', 'compliance_requirement_updated', NULL
  );

-- rules
CREATE TRIGGER tg_audit_rules
  AFTER INSERT OR UPDATE OR DELETE ON governance.rules
  FOR EACH ROW EXECUTE FUNCTION governance_private.tg_audit_log(
    'rule_created', 'rule_modified', 'rule_modified'
  );

-- rule_sets
CREATE TRIGGER tg_audit_rule_sets
  AFTER INSERT OR UPDATE OR DELETE ON governance.rule_sets
  FOR EACH ROW EXECUTE FUNCTION governance_private.tg_audit_log(
    'rule_set_created', 'rule_set_modified', 'rule_set_modified'
  );

-- sod_constraints
CREATE TRIGGER tg_audit_sod_constraints
  AFTER INSERT OR UPDATE OR DELETE ON governance.sod_constraints
  FOR EACH ROW EXECUTE FUNCTION governance_private.tg_audit_log(
    'rule_created', 'rule_modified', 'rule_modified'
  );

-- mcp_servers
CREATE TRIGGER tg_audit_mcp_servers
  AFTER INSERT OR UPDATE OR DELETE ON governance.mcp_servers
  FOR EACH ROW EXECUTE FUNCTION governance_private.tg_audit_log(
    'mcp_server_registered', 'mcp_server_updated', 'mcp_server_updated'
  );

-- products
CREATE TRIGGER tg_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON governance.products
  FOR EACH ROW EXECUTE FUNCTION governance_private.tg_audit_log(
    'product_created', 'product_updated', 'product_updated'
  );

-- risk_assessments
CREATE TRIGGER tg_audit_risk_assessments
  AFTER INSERT OR UPDATE OR DELETE ON governance.risk_assessments
  FOR EACH ROW EXECUTE FUNCTION governance_private.tg_audit_log(
    'risk_assessment_created', 'risk_assessment_updated', NULL
  );

COMMIT;
