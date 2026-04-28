import postgres from 'postgres';

import { AgentsApi } from '../crud/agents';
import { AssignmentsApi } from '../crud/assignments';
import { ComplianceApi } from '../crud/compliance';
import { McpServersApi } from '../crud/mcp-servers';
import { PermissionsApi } from '../crud/permissions';
import { ProductsApi } from '../crud/products';
import { ResourcesApi } from '../crud/resources';
import { RiskAssessmentsApi } from '../crud/risk-assessments';
import { RolesApi } from '../crud/roles';
import { RuleSetsApi } from '../crud/rule-sets';
import { RulesApi } from '../crud/rules';
import { SodConstraintsApi } from '../crud/sod-constraints';
import { ToolsApi } from '../crud/tools';

import { SannaExporterApi } from '../export/sanna-exporter';

import { AuditReplayApi } from '../intelligence/audit-replay';
import { BlastRadiusApi } from '../intelligence/blast-radius';
import { CoverageGapsApi } from '../intelligence/coverage-gaps';
import { EffectivePermissionsApi } from '../intelligence/effective-permissions';
import { PermissionOverlapApi } from '../intelligence/permission-overlap';
import { RiskScoringApi } from '../intelligence/risk-scoring';
import { SodAnalysisApi } from '../intelligence/sod-analysis';
import { ToolInventoryApi } from '../intelligence/tool-inventory';

import { RulesEngine } from '../rules/rule-evaluator';

import { AuditApi } from './audit';
import { createSql, type Sql, type TpsClientOptions } from './connection';
import type {
  AgentToolInventoryRow,
  BlastRadiusRow,
  CoverageGapRow,
  EffectivePermission,
  NetPermission,
  PermissionOverlapRow,
  SodCheckRow,
  TpsContext,
} from './types';

/**
 * The intelligence façade. Keeps the call sites short on typical
 * Layer 3 / KYA queries.
 */
export class IntelligenceApi {
  readonly effectivePermissions: EffectivePermissionsApi;
  readonly sod: SodAnalysisApi;
  readonly blast: BlastRadiusApi;
  readonly overlap: PermissionOverlapApi;
  readonly coverage: CoverageGapsApi;
  readonly tools: ToolInventoryApi;
  readonly risk: RiskScoringApi;
  readonly auditReplay: AuditReplayApi;

  constructor(sql: Sql) {
    this.effectivePermissions = new EffectivePermissionsApi(sql);
    this.sod = new SodAnalysisApi(sql);
    this.blast = new BlastRadiusApi(sql);
    this.overlap = new PermissionOverlapApi(sql);
    this.coverage = new CoverageGapsApi(sql);
    this.tools = new ToolInventoryApi(sql);
    this.risk = new RiskScoringApi(sql);
    this.auditReplay = new AuditReplayApi(sql);
  }

  rawEffectivePermissions(
    ctx: TpsContext,
    agent_id: string
  ): Promise<EffectivePermission[]> {
    return this.effectivePermissions.raw(ctx, agent_id);
  }

  netEffectivePermissions(
    ctx: TpsContext,
    agent_id: string
  ): Promise<NetPermission[]> {
    return this.effectivePermissions.net(ctx, agent_id);
  }

  sodCheck(ctx: TpsContext, agent_id: string): Promise<SodCheckRow[]> {
    return this.sod.check(ctx, agent_id);
  }

  blastRadius(ctx: TpsContext, agent_id: string): Promise<BlastRadiusRow[]> {
    return this.blast.compute(ctx, agent_id);
  }

  permissionOverlap(
    ctx: TpsContext,
    resource_id: string
  ): Promise<PermissionOverlapRow[]> {
    return this.overlap.forResource(ctx, resource_id);
  }

  coverageGaps(ctx: TpsContext): Promise<CoverageGapRow[]> {
    return this.coverage.list(ctx);
  }

  toolInventory(ctx: TpsContext, agent_id: string): Promise<AgentToolInventoryRow[]> {
    return this.tools.forAgent(ctx, agent_id);
  }

  /**
   * KYA façade — alias for `risk.score(...)`. Pure compute, does not write to
   * `risk_assessments`. Use `risk.scoreAndPersist(...)` when you want the row
   * stored.
   */
  computeRiskScore(
    ctx: TpsContext,
    agent_id: string,
    opts?: Parameters<RiskScoringApi['score']>[2]
  ) {
    return this.risk.score(ctx, agent_id, opts);
  }
}

export class ExportApi {
  readonly sanna: SannaExporterApi;

  constructor(sql: Sql) {
    this.sanna = new SannaExporterApi(sql);
  }

  toSannaConstitution(ctx: TpsContext, agent_id: string) {
    return this.sanna.toConstitution(ctx, agent_id);
  }
}

/**
 * Primary entry point for `@tpsdev/governance-engine`. Holds the postgres.js
 * pool and exposes one sub-api per domain. All operations require a
 * {@link TpsContext} so the audit trigger can attribute writes (D016) and
 * RLS can scope reads (D007).
 */
export class TpsClient {
  readonly sql: Sql;
  private readonly ownsSql: boolean;

  readonly agents: AgentsApi;
  readonly products: ProductsApi;
  readonly mcpServers: McpServersApi;
  readonly resources: ResourcesApi;
  readonly tools: ToolsApi;
  readonly roles: RolesApi;
  readonly permissions: PermissionsApi;
  readonly assignments: AssignmentsApi;
  readonly rules: RulesApi;
  readonly ruleSets: RuleSetsApi;
  readonly compliance: ComplianceApi;
  readonly sodConstraints: SodConstraintsApi;
  readonly riskAssessments: RiskAssessmentsApi;

  readonly intelligence: IntelligenceApi;
  readonly export: ExportApi;
  readonly audit: AuditApi;
  readonly rulesEngine: RulesEngine;

  constructor(options: TpsClientOptions) {
    const { sql, ownsSql } = createSql(options);
    this.sql = sql;
    this.ownsSql = ownsSql;

    this.agents = new AgentsApi(sql);
    this.products = new ProductsApi(sql);
    this.mcpServers = new McpServersApi(sql);
    this.resources = new ResourcesApi(sql);
    this.tools = new ToolsApi(sql);
    this.roles = new RolesApi(sql);
    this.permissions = new PermissionsApi(sql);
    this.assignments = new AssignmentsApi(sql);
    this.rules = new RulesApi(sql);
    this.ruleSets = new RuleSetsApi(sql);
    this.compliance = new ComplianceApi(sql);
    this.sodConstraints = new SodConstraintsApi(sql);
    this.riskAssessments = new RiskAssessmentsApi(sql);

    this.intelligence = new IntelligenceApi(sql);
    this.export = new ExportApi(sql);
    this.audit = new AuditApi(sql);
    this.rulesEngine = new RulesEngine(sql);
    // Wire the engine into the CRUD façade so `tps.rules.evaluate(...)` works.
    this.rules.attachEngine(this.rulesEngine);
  }

  /**
   * Close the pool when this client owns it. When the pool was supplied
   * via `options.sql`, ownership stays with the caller and `close()` is a
   * no-op.
   */
  async close(): Promise<void> {
    if (this.ownsSql) {
      await this.sql.end({ timeout: 5 });
    }
  }
}

// Type re-export for inference convenience.
export type { postgres };
