'use client';

import { useState, useTransition } from 'react';

import type {
  AgentLifecycleState,
  RuleResult,
  SannaExportResult,
} from '@tpsdev/governance-engine';

import { ConfirmDialog } from './ConfirmDialog';
import { SeverityBadge } from './SeverityBadge';
import { YamlPreview } from './YamlPreview';

interface Props {
  agentId: string;
  lifecycle: AgentLifecycleState;
  /** Bound from the page: server actions are passed in so the client
   *  component never reaches across the boundary by name. */
  setLifecycle: (next: AgentLifecycleState) => Promise<void>;
  exportConstitution: () => Promise<SannaExportResult>;
  runRiskAssessment: () => Promise<{ risk_score: number; risk_level: string }>;
  evaluateRules: () => Promise<RuleResult[]>;
}

const NEXT_STATES: Record<AgentLifecycleState, AgentLifecycleState[]> = {
  proposed: ['under_review', 'decommissioned'],
  under_review: ['approved', 'decommissioned'],
  approved: ['active', 'suspended', 'decommissioned'],
  active: ['suspended', 'decommissioned'],
  suspended: ['active', 'decommissioned'],
  decommissioned: [],
};

const LABEL_BY_TRANSITION: Record<AgentLifecycleState, string> = {
  proposed: 'PROPOSE',
  under_review: 'SEND TO REVIEW',
  approved: 'APPROVE',
  active: 'ACTIVATE',
  suspended: 'SUSPEND',
  decommissioned: 'DECOMMISSION',
};

/**
 * Header action bar for the KYA Card. Wraps every mutation in the
 * appropriate confirm dialog and surfaces results in modals.
 */
export function AgentActions(props: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmTo, setConfirmTo] = useState<AgentLifecycleState | null>(null);
  const [exportResult, setExportResult] = useState<SannaExportResult | null>(null);
  const [riskResult, setRiskResult] = useState<{ risk_score: number; risk_level: string } | null>(null);
  const [ruleResults, setRuleResults] = useState<RuleResult[] | null>(null);

  const transitions = NEXT_STATES[props.lifecycle];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {transitions.map((next) => (
        <button
          key={next}
          type="button"
          onClick={() => setConfirmTo(next)}
          disabled={pending}
          className="kya-data text-xs px-2 py-1 border border-kya-border-default text-kya-text-secondary hover:border-kya-accent-primary hover:text-kya-accent-primary disabled:opacity-50"
        >
          {LABEL_BY_TRANSITION[next]}
        </button>
      ))}
      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            const r = await props.exportConstitution();
            setExportResult(r);
          })
        }
        disabled={pending}
        className="kya-data text-xs px-2 py-1 border border-kya-border-default text-kya-text-secondary hover:border-kya-accent-primary hover:text-kya-accent-primary disabled:opacity-50"
      >
        EXPORT CONSTITUTION
      </button>
      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            const r = await props.runRiskAssessment();
            setRiskResult(r);
          })
        }
        disabled={pending}
        className="kya-data text-xs px-2 py-1 border border-kya-border-default text-kya-text-secondary hover:border-kya-accent-primary hover:text-kya-accent-primary disabled:opacity-50"
      >
        RUN RISK
      </button>
      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            const r = await props.evaluateRules();
            setRuleResults(r);
          })
        }
        disabled={pending}
        className="kya-data text-xs px-2 py-1 border border-kya-border-default text-kya-text-secondary hover:border-kya-accent-primary hover:text-kya-accent-primary disabled:opacity-50"
      >
        EVALUATE RULES
      </button>

      <ConfirmDialog
        open={confirmTo !== null}
        onClose={() => setConfirmTo(null)}
        onConfirm={async () => {
          if (!confirmTo) return;
          await props.setLifecycle(confirmTo);
        }}
        title={`Transition lifecycle: ${props.lifecycle} → ${confirmTo ?? ''}`}
        body={
          <span>
            This writes to <code>governance.agents</code> and emits an audit
            log entry under your operator identity.
          </span>
        }
        confirmLabel={confirmTo ? LABEL_BY_TRANSITION[confirmTo] : 'CONFIRM'}
        destructive={confirmTo === 'decommissioned' || confirmTo === 'suspended'}
      />

      {/* Constitution export modal */}
      {exportResult && (
        <ResultModal title="SANNA CONSTITUTION" onClose={() => setExportResult(null)}>
          <YamlPreview yaml={exportResult.yaml} policyHash={exportResult.policy_hash} />
        </ResultModal>
      )}

      {/* Risk assessment result */}
      {riskResult && (
        <ResultModal title="RISK ASSESSMENT" onClose={() => setRiskResult(null)}>
          <div className="kya-data flex items-baseline gap-3">
            <span className="text-3xl text-kya-text-primary">{riskResult.risk_score}</span>
            <SeverityBadge level={riskResult.risk_level} />
          </div>
          <div className="mt-2 kya-data text-xs text-kya-text-muted">
            Persisted to governance.risk_assessments.
          </div>
        </ResultModal>
      )}

      {/* Rule evaluation result */}
      {ruleResults && (
        <ResultModal title="RULE EVALUATION" onClose={() => setRuleResults(null)}>
          {ruleResults.length === 0 ? (
            <div className="kya-data text-xs text-kya-text-muted">no rules applied</div>
          ) : (
            <ul className="kya-data text-xs space-y-1">
              {ruleResults.map((r) => (
                <li
                  key={r.rule_id}
                  className="flex items-start gap-2 border-b border-kya-border-default py-1"
                >
                  <span
                    className={
                      r.passed ? 'text-kya-status-low' : 'text-kya-status-critical'
                    }
                  >
                    {r.passed ? 'PASS' : 'FAIL'}
                  </span>
                  <span className="text-kya-text-primary w-48 truncate">{r.rule_name}</span>
                  <span className="text-kya-text-secondary flex-1">{r.details}</span>
                </li>
              ))}
            </ul>
          )}
        </ResultModal>
      )}
    </div>
  );
}

function ResultModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8"
      onClick={onClose}
    >
      <div
        className="bg-kya-bg-secondary border border-kya-border-default w-[680px] max-w-full max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-3 py-2 border-b border-kya-border-default kya-data text-xs uppercase tracking-wider text-kya-text-secondary">
          {title}
          <button
            type="button"
            onClick={onClose}
            className="text-kya-text-muted hover:text-kya-text-primary"
          >
            close
          </button>
        </header>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}
