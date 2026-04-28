/**
 * TPS-specific error hierarchy. Internal callers throw the most specific class;
 * postgres.js error codes are mapped via {@link mapPostgresError}.
 */

export class TpsError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'TpsError';
    this.code = code;
    this.details = details;
  }
}

export class TpsNotFoundError extends TpsError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, 'TPS_NOT_FOUND', { entity, id });
    this.name = 'TpsNotFoundError';
  }
}

export class TpsConflictError extends TpsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TPS_CONFLICT', details);
    this.name = 'TpsConflictError';
  }
}

export class TpsDependencyError extends TpsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TPS_DEPENDENCY', details);
    this.name = 'TpsDependencyError';
  }
}

export class TpsPermissionError extends TpsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TPS_PERMISSION', details);
    this.name = 'TpsPermissionError';
  }
}

export class TpsValidationError extends TpsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TPS_VALIDATION', details);
    this.name = 'TpsValidationError';
  }
}

export class TpsRuleViolationError extends TpsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TPS_RULE_VIOLATION', details);
    this.name = 'TpsRuleViolationError';
  }
}

interface PgErrorLike {
  code?: string;
  message?: string;
  detail?: string;
  table_name?: string;
  constraint_name?: string;
  column_name?: string;
}

/**
 * Wrap a postgres.js error in the most specific TpsError subclass.
 * Returns the original `err` unchanged when no mapping applies.
 */
export function mapPostgresError(err: unknown): unknown {
  if (!err || typeof err !== 'object') return err;
  const pg = err as PgErrorLike;
  const code = pg.code;
  if (!code) return err;

  const details: Record<string, unknown> = {
    pg_code: code,
    pg_message: pg.message,
    pg_detail: pg.detail,
    table: pg.table_name,
    constraint: pg.constraint_name,
    column: pg.column_name,
  };

  switch (code) {
    case '23505': // unique_violation
      return new TpsConflictError(
        `Unique constraint violated${pg.constraint_name ? ` (${pg.constraint_name})` : ''}`,
        details
      );
    case '23503': // foreign_key_violation
      return new TpsDependencyError(
        `Referential integrity violation${pg.constraint_name ? ` (${pg.constraint_name})` : ''}`,
        details
      );
    case '23502': // not_null_violation
      return new TpsValidationError(
        `Required column is null${pg.column_name ? ` (${pg.column_name})` : ''}`,
        details
      );
    case '23514': // check_violation
      return new TpsValidationError(
        `Check constraint violated${pg.constraint_name ? ` (${pg.constraint_name})` : ''}`,
        details
      );
    case '42501': // insufficient_privilege
      return new TpsPermissionError(
        `RLS or grant blocked the operation: ${pg.message ?? 'insufficient privilege'}`,
        details
      );
    case '22P02': // invalid_text_representation (often invalid uuid / enum)
      return new TpsValidationError(
        `Invalid input syntax: ${pg.message ?? 'unparseable value'}`,
        details
      );
    default:
      return err;
  }
}
