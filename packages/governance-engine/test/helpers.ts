import type { EffectivePermission } from '../src/client/types';

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  // Stable shape — looks like a UUID but is deterministic for fixtures.
  const id = String(counter).padStart(12, '0');
  return `${prefix.padEnd(8, '0').slice(0, 8)}-0000-4000-a000-${id}`;
}

export function fakeGrant(overrides: Partial<EffectivePermission> = {}): EffectivePermission {
  return {
    permission_id: overrides.permission_id ?? uid('perm'),
    role_id: overrides.role_id ?? uid('role'),
    role_name: overrides.role_name ?? 'role-x',
    role_depth: overrides.role_depth ?? 0,
    resource_id: overrides.resource_id ?? uid('res'),
    tool_id: overrides.tool_id === undefined ? null : overrides.tool_id,
    actions: overrides.actions ?? ['read'],
    conditions: overrides.conditions ?? null,
    grant_type: overrides.grant_type ?? 'allow',
    expires_at: overrides.expires_at ?? null,
  };
}
