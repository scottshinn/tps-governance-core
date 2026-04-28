import type { Sql } from '../client/connection';
import { withTpsContext, withTpsReadOnly } from '../client/connection';
import type {
  AssessmentMethod,
  PaginatedResult,
  RiskAssessment,
  RiskFactor,
  RiskLevel,
  TpsContext,
} from '../client/types';
import { RISK_LEVEL_BY_SCORE } from '../client/types';
import { compact, listPaginated } from '../utils/crud-helpers';
import { TpsNotFoundError, TpsValidationError } from '../utils/errors';
import { buildWhere } from '../utils/filtering';

export interface CreateRiskAssessmentInput {
  entity_type: string;
  entity_id: string;
  risk_score: 1 | 2 | 3 | 4 | 5;
  risk_factors: RiskFactor[];
  assessment_method: AssessmentMethod;
  /** When omitted, derived from risk_score via {@link RISK_LEVEL_BY_SCORE}. */
  risk_level?: RiskLevel;
  assessor?: string | null;
  notes?: string | null;
  assessed_at?: Date;
  valid_until?: Date | null;
}

export interface ListRiskAssessmentsOptions {
  entity_type?: string;
  entity_id?: string;
  min_score?: 1 | 2 | 3 | 4 | 5;
  assessment_method?: AssessmentMethod;
  limit?: number;
  cursor?: string;
}

export class RiskAssessmentsApi {
  constructor(private readonly sql: Sql) {}

  async create(
    ctx: TpsContext,
    input: CreateRiskAssessmentInput
  ): Promise<RiskAssessment> {
    if (input.risk_score < 1 || input.risk_score > 5) {
      throw new TpsValidationError('risk_score must be 1..5', { input });
    }
    const row: Record<string, unknown> = {
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      risk_score: input.risk_score,
      risk_level: input.risk_level ?? RISK_LEVEL_BY_SCORE[input.risk_score],
      risk_factors: input.risk_factors,
      assessment_method: input.assessment_method,
      assessor: input.assessor,
      notes: input.notes,
      assessed_at: input.assessed_at ?? new Date(),
      valid_until: input.valid_until,
    };
    return withTpsContext(this.sql, ctx, async (tx) => {
      const [out] = await tx<RiskAssessment[]>`
        INSERT INTO governance.risk_assessments ${tx(compact(row))}
        RETURNING *
      `;
      return out;
    });
  }

  async get(ctx: TpsContext, id: string): Promise<RiskAssessment> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<RiskAssessment[]>`
        SELECT * FROM governance.risk_assessments WHERE id = ${id}
      `;
      if (rows.length === 0) throw new TpsNotFoundError('risk_assessment', id);
      return rows[0];
    });
  }

  async list(
    ctx: TpsContext,
    opts: ListRiskAssessmentsOptions = {}
  ): Promise<PaginatedResult<RiskAssessment>> {
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      let where = buildWhere(tx, {
        entity_type: opts.entity_type,
        entity_id: opts.entity_id,
        assessment_method: opts.assessment_method,
      });
      if (opts.min_score) {
        const f = tx`risk_score >= ${opts.min_score}`;
        where = where ? tx`${where} AND ${f}` : f;
      }
      // Risk assessments don't track updated_at; the listPaginated helper
      // expects (created_at, id) which exists on this table.
      return listPaginated<RiskAssessment>(
        tx,
        'governance.risk_assessments',
        { where, cursor: opts.cursor, limit: opts.limit }
      );
    });
  }

  /**
   * The latest assessment for a given entity, or null when none exists.
   *
   * KYA façade: accepts either positional args (engine-native) or an
   * options object `{ entity_type, entity_id }` (matches the KYA spec call
   * shape `tps.riskAssessments.latest(ctx, { entity_type, entity_id })`).
   */
  async latest(
    ctx: TpsContext,
    entity_type: string,
    entity_id: string
  ): Promise<RiskAssessment | null>;
  async latest(
    ctx: TpsContext,
    opts: { entity_type: string; entity_id: string }
  ): Promise<RiskAssessment | null>;
  async latest(
    ctx: TpsContext,
    entityTypeOrOpts: string | { entity_type: string; entity_id: string },
    entity_id?: string
  ): Promise<RiskAssessment | null> {
    const entity_type =
      typeof entityTypeOrOpts === 'string' ? entityTypeOrOpts : entityTypeOrOpts.entity_type;
    const id =
      typeof entityTypeOrOpts === 'string' ? (entity_id as string) : entityTypeOrOpts.entity_id;
    return withTpsReadOnly(this.sql, ctx, async (tx) => {
      const rows = await tx<RiskAssessment[]>`
        SELECT * FROM governance.risk_assessments
        WHERE entity_type = ${entity_type} AND entity_id = ${id}
        ORDER BY assessed_at DESC
        LIMIT 1
      `;
      return rows[0] ?? null;
    });
  }
}
