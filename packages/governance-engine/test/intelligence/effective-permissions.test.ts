import { describe, expect, it } from 'vitest';

import { computeNetPermissions } from '../../src/intelligence/effective-permissions';
import { fakeGrant, uid } from '../helpers';

describe('computeNetPermissions', () => {
  it('returns no rows when there are no grants', () => {
    expect(computeNetPermissions([])).toEqual([]);
  });

  it('preserves an allow grant verbatim when no deny overrides', () => {
    const r = uid('res');
    const t = uid('tool');
    const grants = [
      fakeGrant({
        resource_id: r,
        tool_id: t,
        actions: ['read', 'write'],
        grant_type: 'allow',
      }),
    ];
    const net = computeNetPermissions(grants);
    expect(net).toHaveLength(1);
    expect(net[0].allowed_actions).toEqual(['read', 'write']);
    expect(net[0].denied_actions).toEqual([]);
    expect(net[0].net_actions).toEqual(['read', 'write']);
  });

  it('subtracts deny actions from allow within the same (resource, tool) group', () => {
    const r = uid('res');
    const t = uid('tool');
    const grants = [
      fakeGrant({
        resource_id: r,
        tool_id: t,
        actions: ['read', 'write', 'delete'],
        grant_type: 'allow',
        role_depth: 2,
      }),
      fakeGrant({
        resource_id: r,
        tool_id: t,
        actions: ['read', 'write'],
        grant_type: 'deny',
        role_depth: 0,
      }),
    ];
    const net = computeNetPermissions(grants);
    expect(net).toHaveLength(1);
    expect(net[0].net_actions).toEqual(['delete']);
  });

  it('a deeper allow does NOT win over a shallow deny — deny always wins', () => {
    const r = uid('res');
    const grants = [
      fakeGrant({
        resource_id: r,
        tool_id: null,
        actions: ['delete'],
        grant_type: 'allow',
        role_depth: 0,
      }),
      fakeGrant({
        resource_id: r,
        tool_id: null,
        actions: ['delete'],
        grant_type: 'deny',
        role_depth: 5,
      }),
    ];
    const net = computeNetPermissions(grants);
    expect(net[0].net_actions).toEqual([]);
  });

  it('a tool_id=null deny overrides a specific-tool allow on the same resource', () => {
    const r = uid('res');
    const t = uid('tool');
    const grants = [
      // Specific-tool allow.
      fakeGrant({
        resource_id: r,
        tool_id: t,
        actions: ['execute'],
        grant_type: 'allow',
      }),
      // Broad deny on the same resource (any tool).
      fakeGrant({
        resource_id: r,
        tool_id: null,
        actions: ['execute'],
        grant_type: 'deny',
      }),
    ];
    const net = computeNetPermissions(grants);
    // Two groups: (r, t) and (r, null). Both must show execute as denied/net=[].
    const toolGroup = net.find((n) => n.tool_id === t)!;
    expect(toolGroup.net_actions).toEqual([]);
    expect(toolGroup.denied_actions).toContain('execute');
    expect(toolGroup.grant_lineage.find((l) => l.any_tool && l.grant_type === 'deny')).toBeTruthy();
  });

  it('groups by (resource_id, tool_id) — different tools create separate rows', () => {
    const r = uid('res');
    const t1 = uid('toolA');
    const t2 = uid('toolB');
    const grants = [
      fakeGrant({ resource_id: r, tool_id: t1, actions: ['read'] }),
      fakeGrant({ resource_id: r, tool_id: t2, actions: ['write'] }),
    ];
    const net = computeNetPermissions(grants);
    expect(net).toHaveLength(2);
    expect(new Set(net.map((n) => n.tool_id))).toEqual(new Set([t1, t2]));
  });

  it('preserves allow conditions in the conditions[] field', () => {
    const r = uid('res');
    const t = uid('tool');
    const grants = [
      fakeGrant({
        resource_id: r,
        tool_id: t,
        actions: ['read'],
        grant_type: 'allow',
        conditions: { requires_approval: true, max_per_minute: 10 },
      }),
    ];
    const net = computeNetPermissions(grants);
    expect(net[0].conditions).toEqual([{ requires_approval: true, max_per_minute: 10 }]);
  });

  it('grant_lineage records both allow and deny sources with role depth', () => {
    const r = uid('res');
    const grants = [
      fakeGrant({
        resource_id: r,
        tool_id: null,
        actions: ['read'],
        grant_type: 'allow',
        role_name: 'data-reader',
        role_depth: 0,
      }),
      fakeGrant({
        resource_id: r,
        tool_id: null,
        actions: ['read'],
        grant_type: 'deny',
        role_name: 'pii-block',
        role_depth: 1,
      }),
    ];
    const net = computeNetPermissions(grants);
    expect(net[0].grant_lineage).toHaveLength(2);
    const allow = net[0].grant_lineage.find((l) => l.grant_type === 'allow')!;
    const deny = net[0].grant_lineage.find((l) => l.grant_type === 'deny')!;
    expect(allow.role_name).toBe('data-reader');
    expect(deny.role_name).toBe('pii-block');
  });
});
