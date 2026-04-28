import { describe, expect, it } from 'vitest';

import { BUILT_IN_EVALUATORS } from '../../src/rules/evaluators';
import { RuleEvaluatorRegistry } from '../../src/rules/rule-evaluator';
import type { RuleEvaluator } from '../../src/rules/types';

describe('RuleEvaluatorRegistry', () => {
  it('seeds with the eight built-in evaluators', () => {
    const r = new RuleEvaluatorRegistry();
    expect(r.list().length).toBe(BUILT_IN_EVALUATORS.length);
    expect(r.has('no_access_to_resource_type')).toBe(true);
    expect(r.has('max_sensitive_resource_count')).toBe(true);
    expect(r.has('requires_approval_for_action')).toBe(true);
    expect(r.has('no_pii_output_leakage')).toBe(true);
    expect(r.has('max_role_depth')).toBe(true);
    expect(r.has('no_unrestricted_access')).toBe(true);
    expect(r.has('require_review_cycle')).toBe(true);
    expect(r.has('delegation_scope_enforcement')).toBe(true);
  });

  it('register replaces an existing evaluator with the same type', () => {
    const r = new RuleEvaluatorRegistry();
    const custom: RuleEvaluator = {
      type: 'no_pii_output_leakage',
      async evaluate() {
        throw new Error('should not be called');
      },
    };
    r.register(custom);
    expect(r.get('no_pii_output_leakage')).toBe(custom);
  });

  it('unregister removes an evaluator', () => {
    const r = new RuleEvaluatorRegistry();
    expect(r.unregister('max_role_depth')).toBe(true);
    expect(r.has('max_role_depth')).toBe(false);
  });

  it('starts empty when constructed with []', () => {
    const r = new RuleEvaluatorRegistry([]);
    expect(r.list()).toEqual([]);
  });
});
