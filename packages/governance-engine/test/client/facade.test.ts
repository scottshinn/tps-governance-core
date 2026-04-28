import { describe, expect, it } from 'vitest';

import {
  AuditApi,
  IntelligenceApi,
  RiskAssessmentsApi,
  RulesApi,
  RulesEngine,
} from '../../src/index';

/**
 * Surface tests — confirm the KYA façade methods exist on the public API
 * with the expected call shape. They don't hit a database; they only
 * verify type/shape so KYA can rely on the call sites compiling.
 */
describe('KYA façade surface', () => {
  it('IntelligenceApi exposes computeRiskScore', () => {
    expect(typeof IntelligenceApi.prototype.computeRiskScore).toBe('function');
  });

  it('RulesApi exposes evaluate and complianceCheck (delegated to RulesEngine)', () => {
    expect(typeof RulesApi.prototype.evaluate).toBe('function');
    expect(typeof RulesApi.prototype.complianceCheck).toBe('function');
    expect(typeof RulesApi.prototype.attachEngine).toBe('function');
  });

  it('AuditApi exposes reconstructState (alias for AuditReplayApi.reconstruct)', () => {
    expect(typeof AuditApi.prototype.reconstructState).toBe('function');
  });

  it('RiskAssessmentsApi.latest accepts two call shapes', () => {
    // Both overload signatures resolve to the same runtime function.
    expect(typeof RiskAssessmentsApi.prototype.latest).toBe('function');
    expect(RiskAssessmentsApi.prototype.latest.length).toBeGreaterThanOrEqual(2);
  });

  it('RulesApi.evaluate throws clearly when called before attachEngine', () => {
    // Construct directly so engine isn't wired up.
    const fakeSql: any = () => undefined;
    const api = new RulesApi(fakeSql);
    const ctx = { actor: 'a', role: 'system_admin' as const };
    expect(() => api.evaluate(ctx, 'agent-1')).toThrow(/before engine was attached/);
  });

  it('RulesEngine remains directly accessible (façade does not replace it)', () => {
    expect(typeof RulesEngine.prototype.evaluate).toBe('function');
    expect(typeof RulesEngine.prototype.complianceCheck).toBe('function');
  });
});
