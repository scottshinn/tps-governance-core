import { formatDistanceToNow } from 'date-fns';

/**
 * Relative time, never returning future references for clock skew. Falls
 * back to the ISO date when the input is over a year old (relative time
 * stops being useful past that horizon).
 */
export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  const ageDays = (Date.now() - d.getTime()) / 86_400_000;
  if (ageDays < 0) return 'just now';
  if (ageDays > 365) return d.toISOString().slice(0, 10);
  return `${formatDistanceToNow(d)} ago`;
}

export function isoDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

/**
 * Compute review-overdue status for an agent. Returns:
 *  - 'no-cycle'     — review_cycle_days is null
 *  - 'never'        — has cycle but never reviewed
 *  - 'overdue'      — last review + cycle < now
 *  - 'ok'           — last review + cycle >= now
 */
export function reviewStatus(
  last_review_at: Date | string | null,
  review_cycle_days: number | null
): 'no-cycle' | 'never' | 'overdue' | 'ok' {
  if (!review_cycle_days) return 'no-cycle';
  if (!last_review_at) return 'never';
  const last =
    typeof last_review_at === 'string'
      ? new Date(last_review_at)
      : last_review_at;
  const due = new Date(last);
  due.setDate(due.getDate() + review_cycle_days);
  return due < new Date() ? 'overdue' : 'ok';
}
