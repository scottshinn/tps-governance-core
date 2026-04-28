/**
 * @tpsdev/governance-engine — public API barrel.
 *
 * Re-exports the {@link TpsClient} entry point plus all enums, table
 * interfaces, function-return types, and sub-APIs that consumers
 * commonly need.
 */

export { TpsClient, IntelligenceApi, ExportApi } from './client/tps-client';
export type { ConnectionConfig, Sql, TpsClientOptions, TransactionSql } from './client/connection';
export { withTpsContext, withTpsReadOnly } from './client/connection';
export { AuditApi } from './client/audit';
export type { ListAuditOptions } from './client/audit';

// ---------- Types ----------
export * from './client/types';

// ---------- Errors ----------
export {
  TpsError,
  TpsConflictError,
  TpsDependencyError,
  TpsNotFoundError,
  TpsPermissionError,
  TpsRuleViolationError,
  TpsValidationError,
  mapPostgresError,
} from './utils/errors';

// ---------- Pagination / utilities ----------
export {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  encodeCursor,
  decodeCursor,
} from './utils/pagination';

// ---------- CRUD APIs ----------
export { AgentsApi } from './crud/agents';
export type {
  CreateAgentInput,
  ListAgentsOptions,
  UpdateAgentInput,
} from './crud/agents';
export { AssignmentsApi } from './crud/assignments';
export type {
  CreateAssignmentInput,
  ListAssignmentsOptions,
  UpdateAssignmentInput,
} from './crud/assignments';
export { ComplianceApi } from './crud/compliance';
export type { CreateFrameworkInput, CreateRequirementInput } from './crud/compliance';
export { McpServersApi } from './crud/mcp-servers';
export type {
  CreateMcpServerInput,
  ListMcpServersOptions,
  UpdateMcpServerInput,
} from './crud/mcp-servers';
export { PermissionsApi } from './crud/permissions';
export type {
  CreatePermissionInput,
  ListPermissionsOptions,
  UpdatePermissionInput,
} from './crud/permissions';
export { ProductsApi } from './crud/products';
export type {
  CreateProductInput,
  ListProductsOptions,
  UpdateProductInput,
} from './crud/products';
export { ResourcesApi } from './crud/resources';
export type {
  CreateResourceInput,
  ListResourcesOptions,
  UpdateResourceInput,
} from './crud/resources';
export { RiskAssessmentsApi } from './crud/risk-assessments';
export type {
  CreateRiskAssessmentInput,
  ListRiskAssessmentsOptions,
} from './crud/risk-assessments';
export { RolesApi } from './crud/roles';
export type { CreateRoleInput, ListRolesOptions, UpdateRoleInput } from './crud/roles';
export { RuleSetsApi } from './crud/rule-sets';
export type {
  CreateRuleSetInput,
  ListRuleSetsOptions,
  UpdateRuleSetInput,
} from './crud/rule-sets';
export { RulesApi } from './crud/rules';
export type {
  CreateRuleInput,
  ListRulesOptions,
  UpdateRuleInput,
} from './crud/rules';
export { SodConstraintsApi } from './crud/sod-constraints';
export type {
  CreateSodConstraintInput,
  ListSodConstraintsOptions,
} from './crud/sod-constraints';
export { ToolsApi } from './crud/tools';
export type {
  CreateToolInput,
  ListToolsOptions,
  UpdateToolInput,
} from './crud/tools';

// ---------- Intelligence ----------
export { BlastRadiusApi } from './intelligence/blast-radius';
export type { BlastRadiusSummary } from './intelligence/blast-radius';
export { CoverageGapsApi } from './intelligence/coverage-gaps';
export {
  EffectivePermissionsApi,
  computeNetPermissions,
} from './intelligence/effective-permissions';
export { PermissionOverlapApi } from './intelligence/permission-overlap';
export {
  DEFAULT_RISK_CONFIG,
  RiskScoringApi,
} from './intelligence/risk-scoring';
export type {
  RiskFactorName,
  RiskScoreResult,
  RiskScoringConfig,
  ScoreOptions,
} from './intelligence/risk-scoring';
export { SodAnalysisApi } from './intelligence/sod-analysis';
export type { SodReport } from './intelligence/sod-analysis';
export { ToolInventoryApi } from './intelligence/tool-inventory';
export {
  AuditReplayApi,
} from './intelligence/audit-replay';
export type {
  AgentPointInTimeAccess,
  PointInTimeQuery,
  PointInTimeResult,
} from './intelligence/audit-replay';

// ---------- Rules engine ----------
export { RuleEvaluatorRegistry, RulesEngine } from './rules/rule-evaluator';
export type {
  ComplianceCheckOptions,
  EvaluateOptions,
} from './rules/rule-evaluator';
export type {
  ComplianceReport,
  ComplianceRequirementReport,
  EvaluationContext,
  RuleEvaluator,
  RuleResult,
} from './rules/types';
export { BUILT_IN_EVALUATORS } from './rules/evaluators';

// ---------- Sanna export ----------
export { SannaExporterApi } from './export/sanna-exporter';
export type {
  SannaApiEndpoint,
  SannaApiPermissions,
  SannaAuthorityBoundaries,
  SannaBoundary,
  SannaCategory,
  SannaCliCommand,
  SannaCliPermissions,
  SannaConstitution,
  SannaEnforcement,
  SannaEscalationTarget,
  SannaExportResult,
  SannaHaltCondition,
  SannaIdentity,
  SannaInvariant,
  SannaMustEscalate,
  SannaSeverity,
  SannaTrustTiers,
} from './export/sanna-types';
export { constitutionToYaml } from './export/yaml-serializer';
