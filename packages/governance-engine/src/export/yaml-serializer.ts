import { stringify } from 'yaml';

import type { SannaConstitution } from './sanna-types';

/**
 * Emit canonical YAML for a Sanna constitution. The YAML library handles
 * indentation, key escaping, and string quoting per the YAML 1.2 spec.
 *
 * `lineWidth: 0` disables wrapping so policy_hash is stable across
 * formatters. `sortMapEntries: false` preserves the structural order
 * defined in {@link SannaConstitution}.
 */
export function constitutionToYaml(c: SannaConstitution): string {
  return stringify(c, {
    indent: 2,
    lineWidth: 0,
    sortMapEntries: false,
    nullStr: '~',
  });
}
