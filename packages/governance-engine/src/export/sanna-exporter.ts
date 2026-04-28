import { createHash } from 'node:crypto';

import type { Sql } from '../client/connection';
import { withTpsReadOnly } from '../client/connection';
import type {
  Agent,
  EffectivePermission,
  Resource,
  Rule,
  TpsContext,
} from '../client/types';
import { TpsNotFoundError } from '../utils/errors';
import type {
  SannaApiEndpoint,
  SannaBoundary,
  SannaCategory,
  SannaCliCommand,
  SannaConstitution,
  SannaExportResult,
  SannaHaltCondition,
  SannaInvariant,
  SannaMustEscalate,
  SannaSeverity,
  SannaTrustTiers,
} from './sanna-types';
import { constitutionToYaml } from './yaml-serializer';

const ENGINE_VERSION = '0.0.1';
const CONSTITUTION_VERSION = '1.4';

/**
 * TPS → Sanna mapping per docs/SANNA-PROTOCOL-NOTES.md.
 *
 * - identity comes from the agent + product
 * - boundaries come from rules with scope global/agent/product
 * - invariants come from rules whose violation_action is `deny`
 * - authority_boundaries come from effective allow/deny permissions:
 *     allow with no requires_approval → can_execute
 *     deny → cannot_execute
 *     allow with conditions.requires_approval = true → must_escalate
 * - cli_permissions / api_permissions split from tools by tool_type
 * - trust_tiers map from resource sensitivity + permission state
 * - halt_conditions come from rules with violation_action = 'deny' and severity = 'critical'
 */
export class SannaExporterApi {
  constructor(private readonly sql: Sql) {}

  async toConstitution(
    ctx: TpsContext,
    agent_id: string
  ): Promise<SannaExportResult> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const [agent] = await tx<Agent[]>`
        SELECT * FROM governance.agents WHERE id = ${agent_id}
      `;
      if (!agent) throw new TpsNotFoundError('agent', agent_id);

      let domain: string | undefined;
      if (agent.product_id) {
        const [product] = await tx<{ name: string }[]>`
          SELECT name FROM governance.products WHERE id = ${agent.product_id}
        `;
        domain = product?.name;
      }

      const grants = await tx<EffectivePermission[]>`
        SELECT
          permission_id, role_id, role_name, role_depth,
          resource_id, tool_id, actions, conditions, grant_type, expires_at
        FROM governance.effective_permissions(${agent_id})
      `;

      const tools = await tx<
        { id: string; name: string; tool_type: string }[]
      >`
        SELECT id, name, tool_type FROM governance.tools
        WHERE id = ANY(${grants.map((g) => g.tool_id).filter((x): x is string => !!x)})
      `;
      const toolById = new Map(tools.map((t) => [t.id, t]));

      const resourceIds = Array.from(new Set(grants.map((g) => g.resource_id)));
      let resources: Resource[] = [];
      if (resourceIds.length > 0) {
        resources = await tx<Resource[]>`
          SELECT * FROM governance.resources WHERE id = ANY(${resourceIds})
        `;
      }
      const resourceById = new Map(resources.map((r) => [r.id, r]));

      // Rules in scope: global, agent-scoped to this agent, product-scoped
      // to this agent's product, or resource-scoped to a resource the agent reaches.
      const rules = await tx<Rule[]>`
        SELECT * FROM governance.rules
        WHERE status = 'active'
          AND (
            scope = 'global'
            OR (scope = 'agent' AND scope_entity_id = ${agent_id})
            OR (scope = 'product' AND scope_entity_id = ${agent.product_id})
            OR (scope = 'resource' AND scope_entity_id = ANY(${resourceIds.length === 0 ? [null] : resourceIds}))
          )
        ORDER BY severity, name
      `;

      const constitution = buildConstitution({
        agent,
        domain,
        grants,
        toolById,
        resourceById,
        rules,
      });

      const yaml = constitutionToYaml(constitution);
      const policy_hash = sha256Hex(yaml);

      return {
        yaml,
        policy_hash,
        constitution,
        metadata: {
          agent_id,
          agent_name: agent.name,
          generated_at: new Date().toISOString(),
          engine_version: ENGINE_VERSION,
          rule_count: rules.length,
          permission_count: grants.length,
        },
      };
    });
  }
}

interface BuildArgs {
  agent: Agent;
  domain?: string;
  grants: EffectivePermission[];
  toolById: Map<string, { id: string; name: string; tool_type: string }>;
  resourceById: Map<string, Resource>;
  rules: Rule[];
}

function buildConstitution(args: BuildArgs): SannaConstitution {
  const { agent, domain, grants, toolById, resourceById, rules } = args;

  const c: SannaConstitution = {
    constitution_version: CONSTITUTION_VERSION,
    identity: {
      agent_name: agent.name,
      domain,
      description: agent.purpose,
    },
  };

  // ---------- boundaries (non-deny rules) ----------
  const boundaries: SannaBoundary[] = [];
  rules
    .filter((r) => r.violation_action !== 'deny')
    .forEach((r, i) => {
      boundaries.push({
        id: `B${String(i + 1).padStart(3, '0')}`,
        description: r.description ?? r.name,
        category: ruleTypeToCategory(r.rule_type),
        severity: tpsSeverityToSanna(r.severity),
      });
    });
  if (boundaries.length > 0) c.boundaries = boundaries;

  // ---------- invariants (deny rules) ----------
  const invariants: SannaInvariant[] = [];
  rules
    .filter((r) => r.violation_action === 'deny')
    .forEach((r, i) => {
      invariants.push({
        id: r.name.startsWith('INV_')
          ? r.name
          : `INV_CUSTOM_${String(i + 1).padStart(3, '0')}`,
        rule: r.description ?? r.name,
        enforcement: 'halt',
        check: (r.condition as { type?: string }).type,
      });
    });
  if (invariants.length > 0) c.invariants = invariants;

  // ---------- authority_boundaries ----------
  const can_execute = new Set<string>();
  const cannot_execute = new Set<string>();
  const must_escalate: SannaMustEscalate[] = [];
  for (const g of grants) {
    if (!g.tool_id) continue;
    const tool = toolById.get(g.tool_id);
    if (!tool) continue;
    if (g.grant_type === 'deny') {
      cannot_execute.add(tool.name);
      continue;
    }
    const requiresApproval =
      !!g.conditions && (g.conditions as Record<string, unknown>).requires_approval === true;
    if (requiresApproval) {
      must_escalate.push({
        condition: `Tool '${tool.name}' requires approval before invocation.`,
        target: { type: 'human', contact: agent.contact ?? agent.owner },
      });
    } else {
      can_execute.add(tool.name);
    }
  }
  // Resource-scoped allow/deny without a tool — fold into authority hints
  // by the resource name pattern (caller can post-process).
  const authority: SannaConstitution['authority_boundaries'] = {};
  if (can_execute.size > 0) authority.can_execute = Array.from(can_execute).sort();
  if (cannot_execute.size > 0) authority.cannot_execute = Array.from(cannot_execute).sort();
  if (must_escalate.length > 0) authority.must_escalate = must_escalate;
  if (Object.keys(authority).length > 0) c.authority_boundaries = authority;

  // ---------- cli_permissions / api_permissions ----------
  const cliCommands: SannaCliCommand[] = [];
  const apiEndpoints: SannaApiEndpoint[] = [];
  let cliCounter = 1;
  let apiCounter = 1;
  for (const g of grants) {
    if (!g.tool_id) continue;
    const tool = toolById.get(g.tool_id);
    if (!tool) continue;
    const authorityClass: SannaCliCommand['authority'] =
      g.grant_type === 'deny'
        ? 'cannot_execute'
        : (g.conditions as Record<string, unknown> | null)?.requires_approval === true
          ? 'must_escalate'
          : 'can_execute';
    if (tool.tool_type === 'custom' || tool.tool_type === 'file_operation') {
      cliCommands.push({
        id: `cli-${String(cliCounter++).padStart(3, '0')}`,
        binary: tool.name,
        authority: authorityClass,
      });
    } else if (tool.tool_type === 'api_call' || tool.tool_type === 'webhook_trigger') {
      const resource = resourceById.get(g.resource_id);
      apiEndpoints.push({
        id: `api-${String(apiCounter++).padStart(3, '0')}`,
        url_pattern: resource?.location ?? tool.name,
        methods: actionsToHttpMethods(g.actions),
        authority: authorityClass,
      });
    }
  }
  if (cliCommands.length > 0) {
    c.cli_permissions = { mode: 'strict', commands: cliCommands };
  }
  if (apiEndpoints.length > 0) {
    c.api_permissions = { mode: 'strict', endpoints: apiEndpoints };
  }

  // ---------- trust_tiers ----------
  const trust: SannaTrustTiers = { autonomous: [], requires_approval: [], prohibited: [] };
  const seenResources = new Set<string>();
  for (const g of grants) {
    if (seenResources.has(g.resource_id)) continue;
    seenResources.add(g.resource_id);
    const resource = resourceById.get(g.resource_id);
    if (!resource) continue;
    if (g.grant_type === 'deny') {
      trust.prohibited!.push(resource.name);
      continue;
    }
    const requiresApproval =
      !!g.conditions && (g.conditions as Record<string, unknown>).requires_approval === true;
    if (requiresApproval) trust.requires_approval!.push(resource.name);
    else trust.autonomous!.push(resource.name);
  }
  if (trust.autonomous?.length === 0) delete trust.autonomous;
  if (trust.requires_approval?.length === 0) delete trust.requires_approval;
  if (trust.prohibited?.length === 0) delete trust.prohibited;
  if (Object.keys(trust).length > 0) {
    if (trust.autonomous) trust.autonomous.sort();
    if (trust.requires_approval) trust.requires_approval.sort();
    if (trust.prohibited) trust.prohibited.sort();
    c.trust_tiers = trust;
  }

  // ---------- halt_conditions ----------
  const halts: SannaHaltCondition[] = [];
  rules
    .filter((r) => r.violation_action === 'deny' && r.severity === 'critical')
    .forEach((r, i) => {
      halts.push({
        id: `H${String(i + 1).padStart(3, '0')}`,
        trigger: r.description ?? r.name,
        escalate_to: agent.contact ?? agent.owner,
        severity: 'critical',
        enforcement: 'halt',
      });
    });
  if (halts.length > 0) c.halt_conditions = halts;

  return c;
}

function ruleTypeToCategory(rule_type: string): SannaCategory {
  switch (rule_type) {
    case 'access_control':
      return 'authorization';
    case 'data_protection':
      return 'confidentiality';
    case 'segregation_of_duties':
      return 'authorization';
    case 'risk_threshold':
      return 'safety';
    case 'coverage_requirement':
      return 'compliance';
    case 'approval_requirement':
      return 'authorization';
    case 'delegation_constraint':
      return 'scope';
    default:
      return 'custom';
  }
}

function tpsSeverityToSanna(s: string): SannaSeverity {
  switch (s) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'info';
  }
}

function actionsToHttpMethods(actions: string[]): string[] {
  const out = new Set<string>();
  for (const a of actions) {
    switch (a) {
      case 'read':
        out.add('GET');
        break;
      case 'write':
        out.add('PUT');
        out.add('PATCH');
        break;
      case 'create':
        out.add('POST');
        break;
      case 'delete':
        out.add('DELETE');
        break;
      case 'execute':
        out.add('POST');
        break;
      default:
        break;
    }
  }
  return Array.from(out).sort();
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
