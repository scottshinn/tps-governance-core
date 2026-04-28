import type { Severity, RiskLevel } from '@tpsdev/governance-engine';

const colorBySeverity: Record<string, string> = {
  critical: 'bg-kya-status-critical text-kya-bg-primary',
  high: 'bg-kya-status-high text-kya-bg-primary',
  medium: 'bg-kya-status-medium text-kya-bg-primary',
  low: 'bg-kya-status-low text-kya-bg-primary',
  informational: 'bg-kya-status-info text-kya-bg-primary',
  // RiskLevel synonyms
  negligible: 'bg-kya-text-muted text-kya-bg-primary',
  moderate: 'bg-kya-status-medium text-kya-bg-primary',
};

/**
 * Risk / severity pill — colored background, uppercase mono label.
 * Accepts both `Severity` and `RiskLevel` values; the union covers the
 * full vocabulary used across rules, SoD constraints, and risk scores.
 */
export function SeverityBadge({
  level,
}: {
  level: Severity | RiskLevel | string;
}) {
  const cls = colorBySeverity[level] ?? 'bg-kya-bg-surface text-kya-text-secondary';
  return (
    <span className={`inline-block px-1.5 py-0.5 kya-data text-xs uppercase ${cls}`}>
      {level}
    </span>
  );
}
