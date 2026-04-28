import { describe, expect, it } from 'vitest';

import {
  mapPostgresError,
  TpsConflictError,
  TpsDependencyError,
  TpsNotFoundError,
  TpsPermissionError,
  TpsValidationError,
} from '../../src/utils/errors';

describe('mapPostgresError', () => {
  it('maps unique_violation (23505) to TpsConflictError', () => {
    const err = { code: '23505', message: 'duplicate key', constraint_name: 'agents_pkey' };
    expect(mapPostgresError(err)).toBeInstanceOf(TpsConflictError);
  });

  it('maps foreign_key_violation (23503) to TpsDependencyError', () => {
    const err = { code: '23503', message: 'fk violation', constraint_name: 'fk_x' };
    expect(mapPostgresError(err)).toBeInstanceOf(TpsDependencyError);
  });

  it('maps not_null_violation (23502) to TpsValidationError', () => {
    const err = { code: '23502', column_name: 'name' };
    expect(mapPostgresError(err)).toBeInstanceOf(TpsValidationError);
  });

  it('maps insufficient_privilege (42501) to TpsPermissionError', () => {
    const err = { code: '42501', message: 'permission denied' };
    expect(mapPostgresError(err)).toBeInstanceOf(TpsPermissionError);
  });

  it('passes unknown error codes through unchanged', () => {
    const err = new Error('mystery');
    expect(mapPostgresError(err)).toBe(err);
  });

  it('preserves the original message in TpsNotFoundError', () => {
    const e = new TpsNotFoundError('agent', 'abc');
    expect(e.message).toContain('agent');
    expect(e.message).toContain('abc');
  });
});
