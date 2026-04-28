import type { RuleEvaluator } from '../types';
import { delegationScopeEnforcementEvaluator } from './delegation-scope-enforcement';
import { maxRoleDepthEvaluator } from './max-role-depth';
import { maxSensitiveResourceCountEvaluator } from './max-sensitive-resource-count';
import { noAccessToResourceTypeEvaluator } from './no-access-to-resource-type';
import { noPiiOutputLeakageEvaluator } from './no-pii-output-leakage';
import { noUnrestrictedAccessEvaluator } from './no-unrestricted-access';
import { requireReviewCycleEvaluator } from './require-review-cycle';
import { requiresApprovalForActionEvaluator } from './requires-approval-for-action';

/** Built-in evaluator set. Exposed so callers can compose with custom evaluators. */
export const BUILT_IN_EVALUATORS: RuleEvaluator[] = [
  noAccessToResourceTypeEvaluator,
  maxSensitiveResourceCountEvaluator,
  requiresApprovalForActionEvaluator,
  noPiiOutputLeakageEvaluator,
  maxRoleDepthEvaluator,
  noUnrestrictedAccessEvaluator,
  requireReviewCycleEvaluator,
  delegationScopeEnforcementEvaluator,
];

export {
  delegationScopeEnforcementEvaluator,
  maxRoleDepthEvaluator,
  maxSensitiveResourceCountEvaluator,
  noAccessToResourceTypeEvaluator,
  noPiiOutputLeakageEvaluator,
  noUnrestrictedAccessEvaluator,
  requireReviewCycleEvaluator,
  requiresApprovalForActionEvaluator,
};
