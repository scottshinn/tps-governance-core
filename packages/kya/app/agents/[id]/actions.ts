'use server';

import { revalidatePath } from 'next/cache';

import type {
  AgentLifecycleState,
  RuleResult,
  SannaExportResult,
} from '@tpsdev/governance-engine';

import { getDefaultContext, getTpsClient } from '@/lib/tps';

/**
 * Server Actions for the KYA Card. Every mutation revalidates the relevant
 * page so the next render reflects the new state without a manual refresh.
 *
 * Phase 1: actor + role come from env vars via {@link getDefaultContext}.
 * Phase 3 will resolve the context from the authenticated session.
 */
export async function setAgentLifecycle(
  agentId: string,
  next: AgentLifecycleState
) {
  const tps = getTpsClient();
  const ctx = getDefaultContext();
  await tps.agents.setLifecycleState(ctx, agentId, next);
  revalidatePath(`/agents/${agentId}`);
  revalidatePath('/agents');
}

export async function exportConstitution(
  agentId: string
): Promise<SannaExportResult> {
  const tps = getTpsClient();
  const ctx = getDefaultContext();
  return tps.export.toSannaConstitution(ctx, agentId);
}

export async function runRiskAssessment(agentId: string) {
  const tps = getTpsClient();
  const ctx = getDefaultContext();
  const result = await tps.intelligence.risk.scoreAndPersist(ctx, agentId);
  revalidatePath(`/agents/${agentId}`);
  return {
    risk_score: result.risk_score,
    risk_level: result.risk_level,
    factors: result.factors,
  };
}

export async function evaluateRulesForAgent(
  agentId: string
): Promise<RuleResult[]> {
  const tps = getTpsClient();
  const ctx = getDefaultContext();
  return tps.rules.evaluate(ctx, agentId);
}
