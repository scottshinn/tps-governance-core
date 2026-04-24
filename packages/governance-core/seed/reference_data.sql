-- Seed: reference data for governance-core
-- Run after all deploy scripts have been applied.

BEGIN;

-- ============================================================
-- Compliance Frameworks
-- ============================================================

INSERT INTO governance.compliance_frameworks (id, name, version, description, framework_type, effective_date, source_url) VALUES
  ('00000001-0000-4000-a000-000000000001', 'GDPR', '2018', 'EU General Data Protection Regulation', 'regulation', '2018-05-25', 'https://gdpr-info.eu/'),
  ('00000001-0000-4000-a000-000000000002', 'EU AI Act', '2024', 'European Union Artificial Intelligence Act', 'regulation', '2024-08-01', 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689'),
  ('00000001-0000-4000-a000-000000000003', 'SOC 2 Type II', '2017', 'AICPA System and Organization Controls 2 — Trust Services Criteria', 'standard', '2017-01-01', 'https://www.aicpa.org/topic/audit-assurance/audit-and-assurance-greater-than-soc-2'),
  ('00000001-0000-4000-a000-000000000004', 'Internal Policy', '1.0', 'Template internal AI governance policy — customize per organization', 'internal_policy', NULL, NULL);

-- ============================================================
-- GDPR Requirements (key articles relevant to AI agents)
-- ============================================================

INSERT INTO governance.compliance_requirements (framework_id, reference_code, description, status) VALUES
  ('00000001-0000-4000-a000-000000000001', 'Art. 5(1)(b)', 'Purpose limitation: data collected for specified, explicit, and legitimate purposes and not further processed in a manner incompatible with those purposes.', 'not_met'),
  ('00000001-0000-4000-a000-000000000001', 'Art. 5(1)(c)', 'Data minimisation: data adequate, relevant, and limited to what is necessary in relation to the purposes for which they are processed.', 'not_met'),
  ('00000001-0000-4000-a000-000000000001', 'Art. 5(1)(f)', 'Integrity and confidentiality: appropriate technical measures to ensure security of personal data, including protection against unauthorised access.', 'not_met'),
  ('00000001-0000-4000-a000-000000000001', 'Art. 25', 'Data protection by design and by default: implement appropriate technical measures.', 'not_met'),
  ('00000001-0000-4000-a000-000000000001', 'Art. 30', 'Records of processing activities: maintain records of all categories of processing activities.', 'not_met');

-- ============================================================
-- EU AI Act Requirements (key articles for high-risk AI)
-- ============================================================

INSERT INTO governance.compliance_requirements (framework_id, reference_code, description, status) VALUES
  ('00000001-0000-4000-a000-000000000002', 'Art. 9', 'Risk management system: establish, implement, document, and maintain a risk management system for high-risk AI systems throughout their lifecycle.', 'not_met'),
  ('00000001-0000-4000-a000-000000000002', 'Art. 10', 'Data and data governance: training, validation, and testing data sets shall be subject to appropriate data governance and management practices.', 'not_met'),
  ('00000001-0000-4000-a000-000000000002', 'Art. 12', 'Record-keeping: high-risk AI systems shall be designed to automatically record events relevant to the system''s operation.', 'not_met'),
  ('00000001-0000-4000-a000-000000000002', 'Art. 14', 'Human oversight: high-risk AI systems shall be designed to be effectively overseen by natural persons.', 'not_met'),
  ('00000001-0000-4000-a000-000000000002', 'Art. 17', 'Quality management system: providers shall put a quality management system in place.', 'not_met');

-- ============================================================
-- SOC 2 Trust Services Criteria (relevant to AI agent deployments)
-- ============================================================

INSERT INTO governance.compliance_requirements (framework_id, reference_code, description, status) VALUES
  ('00000001-0000-4000-a000-000000000003', 'CC6.1', 'Logical access security: the entity implements logical access security software, infrastructure, and architectures over protected information assets.', 'not_met'),
  ('00000001-0000-4000-a000-000000000003', 'CC6.2', 'New access: prior to issuing system credentials, the entity registers and authorizes new internal and external users.', 'not_met'),
  ('00000001-0000-4000-a000-000000000003', 'CC6.3', 'Access removal: the entity removes access to protected information assets when appropriate.', 'not_met'),
  ('00000001-0000-4000-a000-000000000003', 'CC7.2', 'System monitoring: the entity monitors system components and the operation of those components for anomalies.', 'not_met'),
  ('00000001-0000-4000-a000-000000000003', 'CC9.2', 'Vendor and business partner risk: the entity assesses and manages risks associated with vendors and business partners.', 'not_met');

-- ============================================================
-- Built-in Roles
-- ============================================================

INSERT INTO governance.roles (id, name, description, scope, is_built_in) VALUES
  ('00000002-0000-4000-a000-000000000001', 'system_admin',          'Full administrative access to all governance schema objects. Unrestricted.',           'global', true),
  ('00000002-0000-4000-a000-000000000002', 'governance_admin',      'Can manage all governance entities: agents, roles, permissions, rules, and frameworks.', 'global', true),
  ('00000002-0000-4000-a000-000000000003', 'agent_operator',        'Can view and manage agents and their role assignments. Cannot modify rules or compliance frameworks.', 'global', true),
  ('00000002-0000-4000-a000-000000000004', 'auditor',               'Read-only access to all governance data including the full audit log.',                 'global', true),
  ('00000002-0000-4000-a000-000000000005', 'read_only_observer',    'Read-only access to active agents, resources, and tools. No access to audit log.',     'global', true);

-- ============================================================
-- Common SoD Constraint Templates (no permissions assigned yet — configure per deployment)
-- ============================================================

INSERT INTO governance.sod_constraints (id, name, description, constraint_type, severity, is_active) VALUES
  ('00000003-0000-4000-a000-000000000001',
   'Initiate-Approve Separation',
   'An agent that can initiate a sensitive action must not also be able to approve it. Prevents self-authorization of high-value operations.',
   'same_agent', 'critical', false),
  ('00000003-0000-4000-a000-000000000002',
   'Data Access — Data Deletion Separation',
   'An agent with broad read access to a sensitive resource must not also hold delete permissions on the same resource.',
   'same_agent', 'high', false),
  ('00000003-0000-4000-a000-000000000003',
   'Config Read — Config Write Separation',
   'Agents that read system configuration for decision-making must not also be able to modify it.',
   'same_agent', 'high', false),
  ('00000003-0000-4000-a000-000000000004',
   'Credential Access — System Admin Separation',
   'Agents with access to authentication credentials (secrets) must not also hold admin permissions on any system resource.',
   'same_agent', 'critical', false);

COMMIT;
