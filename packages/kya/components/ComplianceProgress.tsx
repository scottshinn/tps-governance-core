/**
 * Single-line framework compliance summary. Shows "name: met/total" with
 * a thin progress bar. Caller composes a list of these in the KYA Card
 * compliance panel.
 */
export function ComplianceProgress({
  name,
  met,
  total,
}: {
  name: string;
  met: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((met / total) * 100);
  const barColor =
    pct === 100
      ? 'bg-kya-status-low'
      : pct >= 50
        ? 'bg-kya-status-medium'
        : 'bg-kya-status-high';
  return (
    <div className="flex items-center gap-2 kya-data text-xs py-1">
      <span className="text-kya-text-primary w-24 truncate">{name}</span>
      <div className="flex-1 h-1.5 bg-kya-bg-tertiary relative">
        <div
          className={`absolute inset-y-0 left-0 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-kya-text-secondary tabular-nums">
        {met}/{total}
      </span>
    </div>
  );
}
