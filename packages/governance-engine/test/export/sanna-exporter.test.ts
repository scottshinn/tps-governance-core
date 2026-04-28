import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  constitutionToYaml,
  type SannaConstitution,
} from '../../src/index';

describe('constitutionToYaml', () => {
  const sample: SannaConstitution = {
    constitution_version: '1.4',
    identity: {
      agent_name: 'payment-processor',
      domain: 'payments',
      description: 'Process customer payments via Stripe',
    },
    boundaries: [
      {
        id: 'B001',
        description: 'Agent may only read data autonomously',
        category: 'scope',
        severity: 'high',
      },
    ],
    authority_boundaries: {
      can_execute: ['stripe_create_charge', 'stripe_read_balance'],
      cannot_execute: ['database_drop_all'],
    },
    trust_tiers: {
      autonomous: ['analytics-db'],
      requires_approval: ['external-api'],
      prohibited: ['credentials-vault'],
    },
  };

  it('emits valid YAML with stable ordering', () => {
    const yaml = constitutionToYaml(sample);
    expect(yaml).toContain('constitution_version: "1.4"');
    expect(yaml).toContain('agent_name: payment-processor');
    expect(yaml).toContain('can_execute:');
  });

  it('produces a deterministic policy hash for identical input', () => {
    const a = constitutionToYaml(sample);
    const b = constitutionToYaml(sample);
    expect(a).toBe(b);
    const hashA = createHash('sha256').update(a).digest('hex');
    const hashB = createHash('sha256').update(b).digest('hex');
    expect(hashA).toBe(hashB);
  });

  it('includes only the structural sections defined on the input', () => {
    const minimal: SannaConstitution = {
      constitution_version: '1.4',
      identity: { agent_name: 'm' },
    };
    const yaml = constitutionToYaml(minimal);
    expect(yaml).toContain('agent_name: m');
    expect(yaml).not.toContain('boundaries:');
    expect(yaml).not.toContain('halt_conditions:');
  });
});
