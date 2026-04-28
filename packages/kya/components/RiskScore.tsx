import type { RiskAssessment, RiskFactor } from '@tpsdev/governance-engine';

import { SeverityBadge } from './SeverityBadge';

const numberColor: Record<number, string> = {
  1: 'text-kya-text-muted',
  2: 'text-kya-status-low',
  3: 'text-kya-status-medium',
  4: 'text-kya-status-high',
  5: 'text-kya-status-critical',
};

/**
 * Large risk score display with contributing factors below.
 * Caller passes either an existing assessment row or a freshly-computed
 * `{ risk_score, risk_level, factors }` shape.
 */
export function RiskScore({
  assessment,
}: {
  assessment: Pick<RiskAssessment, 'risk_score' | 'risk_level'> & {
    risk_factors: RiskFactor[];
  } | null;
}) {
  if (!assessment) {
    return (
      <div className="kya-data text-sm text-kya-text-muted">
        no assessment yet
      </div>
    );
  }
  const colorCls = numberColor[assessment.risk_score] ?? 'text-kya-text-primary';
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className={`kya-data text-4xl font-bold ${colorCls}`}>
          {assessment.risk_score}
        </span>
        <SeverityBadge level={assessment.risk_level} />
      </div>
      {assessment.risk_factors.length === 0 ? (
        <div className="mt-2 kya-data text-xs text-kya-text-muted">
          no contributing factors
        </div>
      ) : (
        <ul className="mt-2 border border-kya-border-default kya-data text-xs">
          {assessment.risk_factors.map((f, i) => (
            <li
              key={`${f.factor}-${i}`}
              className="flex justify-between px-2 py-1 border-b last:border-b-0 border-kya-border-default"
            >
              <span className="text-kya-text-primary">{f.factor}</span>
              <span className="text-kya-text-muted">w={f.weight}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
