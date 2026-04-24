-- Revert schemas/governance/functions/attach_audit_triggers from pg

BEGIN;

DROP TRIGGER tg_audit_agents ON governance.agents;
DROP TRIGGER tg_audit_resources ON governance.resources;
DROP TRIGGER tg_audit_tools ON governance.tools;
DROP TRIGGER tg_audit_roles ON governance.roles;
DROP TRIGGER tg_audit_permissions ON governance.permissions;
DROP TRIGGER tg_audit_agent_role_assignments ON governance.agent_role_assignments;
DROP TRIGGER tg_audit_compliance_frameworks ON governance.compliance_frameworks;
DROP TRIGGER tg_audit_compliance_requirements ON governance.compliance_requirements;
DROP TRIGGER tg_audit_rules ON governance.rules;
DROP TRIGGER tg_audit_rule_sets ON governance.rule_sets;
DROP TRIGGER tg_audit_sod_constraints ON governance.sod_constraints;
DROP TRIGGER tg_audit_mcp_servers ON governance.mcp_servers;
DROP TRIGGER tg_audit_products ON governance.products;
DROP TRIGGER tg_audit_risk_assessments ON governance.risk_assessments;

COMMIT;
