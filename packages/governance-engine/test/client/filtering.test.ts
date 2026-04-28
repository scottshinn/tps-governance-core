import { describe, expect, it } from 'vitest';

import { buildWhere } from '../../src/utils/filtering';

describe('buildWhere', () => {
  it('rejects unsafe column names', () => {
    const fakeSql: any = () => ({});
    fakeSql.unsafe = () => ({});
    expect(() => buildWhere(fakeSql, { 'evil; DROP TABLE foo': 1 })).toThrow(
      /unsafe filter column name/i
    );
  });

  it('returns null when no filters match', () => {
    const fakeSql: any = () => ({});
    expect(buildWhere(fakeSql, { x: undefined })).toBeNull();
  });
});
