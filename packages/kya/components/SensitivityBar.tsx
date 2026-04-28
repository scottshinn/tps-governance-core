import type {
  BlastRadiusRow,
  SensitivityClassification,
} from '@tpsdev/governance-engine';

const order: SensitivityClassification[] = [
  'critical',
  'restricted',
  'confidential',
  'internal',
  'public',
];

const colorBySensitivity: Record<SensitivityClassification, string> = {
  critical: 'bg-kya-status-critical',
  restricted: 'bg-kya-status-high',
  confidential: 'bg-kya-status-medium',
  internal: 'bg-kya-status-info',
  public: 'bg-kya-text-muted',
};

/**
 * Horizontal stacked bar showing resource counts by sensitivity. Used in
 * the KYA Card blast-radius summary panel.
 */
export function SensitivityBar({ rows }: { rows: BlastRadiusRow[] }) {
  const counts: Record<SensitivityClassification, number> = {
    public: 0,
    internal: 0,
    confidential: 0,
    restricted: 0,
    critical: 0,
  };
  for (const r of rows) counts[r.sensitivity] += 1;
  const total = rows.length;

  return (
    <div>
      <div className="flex h-2 border border-kya-border-default">
        {total === 0 ? (
          <div className="w-full bg-kya-bg-tertiary" />
        ) : (
          order.map((s) =>
            counts[s] === 0 ? null : (
              <div
                key={s}
                className={colorBySensitivity[s]}
                style={{ width: `${(counts[s] / total) * 100}%` }}
                title={`${s}: ${counts[s]}`}
              />
            )
          )
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 kya-data text-xs">
        {order.map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className={`inline-block w-2 h-2 ${colorBySensitivity[s]}`} />
            <span className="text-kya-text-secondary">{s}</span>
            <span className="tabular-nums text-kya-text-primary">{counts[s]}</span>
          </span>
        ))}
        <span className="ml-auto text-kya-text-muted">total {total}</span>
      </div>
    </div>
  );
}
