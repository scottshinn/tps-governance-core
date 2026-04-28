import { TpsClient, type TpsContext, type TpsRole } from '@tpsdev/governance-engine';

/**
 * Server-side singleton wrapping `@tpsdev/governance-engine`'s `TpsClient`.
 * Reused across all Server Components and Server Actions.
 *
 * Phase 1: env-var-driven connection. Phase 3 will resolve the operator's
 * `TpsContext` from the authenticated session — see {@link getDefaultContext}.
 */
let client: TpsClient | null = null;

export function getTpsClient(): TpsClient {
  if (client) return client;

  const host = required('TPS_DB_HOST');
  const port = Number(required('TPS_DB_PORT'));
  const database = required('TPS_DB_NAME');
  const username = required('TPS_DB_USER');
  const password = required('TPS_DB_PASSWORD');

  client = new TpsClient({
    connection: { host, port, database, username, password },
  });
  return client;
}

/**
 * Default operator context for Phase 1. The actor lands in `tps.current_actor`
 * (audit attribution, D016) and the role lands in `tps.role` (RLS, D007).
 *
 * Phase 3 replaces this with a session-derived context — at that point
 * Server Components will pass the resolved {@link TpsContext} explicitly
 * rather than reading from env.
 */
export function getDefaultContext(): TpsContext {
  return {
    actor: process.env.TPS_DEFAULT_ACTOR ?? 'kya-operator',
    role: (process.env.TPS_DEFAULT_ROLE as TpsRole | undefined) ?? 'governance_admin',
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example for the full set.`
    );
  }
  return value;
}
