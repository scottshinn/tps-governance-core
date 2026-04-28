import type { AgentLifecycleState } from '@tpsdev/governance-engine';

const colorByState: Record<AgentLifecycleState, string> = {
  proposed: 'bg-kya-state-proposed',
  under_review: 'bg-kya-state-under-review',
  approved: 'bg-kya-state-approved',
  active: 'bg-kya-state-active',
  suspended: 'bg-kya-state-suspended',
  decommissioned: 'bg-kya-state-decommissioned',
};

const labelByState: Record<AgentLifecycleState, string> = {
  proposed: 'PROPOSED',
  under_review: 'REVIEW',
  approved: 'APPROVED',
  active: 'ACTIVE',
  suspended: 'SUSPENDED',
  decommissioned: 'DECOMM',
};

/**
 * Lifecycle state pill — colored dot + uppercase mono label.
 * The dot uses the lifecycle palette tokens (`--color-kya-state-*`).
 */
export function StatusBadge({ state }: { state: AgentLifecycleState }) {
  return (
    <span className="inline-flex items-center gap-1.5 kya-data text-xs">
      <span className={`inline-block w-2 h-2 ${colorByState[state]}`} aria-hidden />
      <span className="text-kya-text-primary">{labelByState[state]}</span>
    </span>
  );
}
