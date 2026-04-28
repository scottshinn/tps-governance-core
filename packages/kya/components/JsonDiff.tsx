/**
 * Renders an audit-event state transition. Three modes:
 *  - INSERT: previous null, new object → renders `+` prefixed lines
 *  - DELETE: previous object, new null → renders `-` prefixed lines
 *  - UPDATE: both non-null → renders `field: old → new` for changed keys
 *
 * Pure UI; no diff library — keeps the bundle small and the markup
 * deterministic for snapshot tests.
 */
export function JsonDiff({
  previous,
  next,
}: {
  previous: Record<string, unknown> | null;
  next: Record<string, unknown> | null;
}) {
  if (previous === null && next !== null) {
    return (
      <pre className="kya-data text-xs text-kya-text-secondary whitespace-pre-wrap">
        {Object.entries(next).map(([k, v]) => (
          <div key={k} className="flex">
            <span className="text-kya-status-low w-3">+</span>
            <span className="text-kya-text-primary mr-2">{k}:</span>
            <span className="text-kya-text-secondary">{format(v)}</span>
          </div>
        ))}
      </pre>
    );
  }

  if (previous !== null && next === null) {
    return (
      <pre className="kya-data text-xs text-kya-text-secondary whitespace-pre-wrap">
        {Object.entries(previous).map(([k, v]) => (
          <div key={k} className="flex">
            <span className="text-kya-status-critical w-3">-</span>
            <span className="text-kya-text-primary mr-2">{k}:</span>
            <span className="text-kya-text-secondary">{format(v)}</span>
          </div>
        ))}
      </pre>
    );
  }

  if (!previous || !next) {
    return (
      <span className="kya-data text-xs text-kya-text-muted">
        no state recorded
      </span>
    );
  }

  // UPDATE — diff only changed keys.
  const keys = Array.from(new Set([...Object.keys(previous), ...Object.keys(next)]));
  const changes = keys
    .filter((k) => !shallowEqual(previous[k], next[k]))
    .filter((k) => k !== 'updated_at'); // noisy; the trigger always bumps it

  if (changes.length === 0) {
    return (
      <span className="kya-data text-xs text-kya-text-muted">
        no field changed (trigger fired on touch)
      </span>
    );
  }
  return (
    <pre className="kya-data text-xs text-kya-text-secondary whitespace-pre-wrap">
      {changes.map((k) => (
        <div key={k}>
          <span className="text-kya-text-primary mr-2">Δ {k}:</span>
          <span className="text-kya-status-critical">{format(previous[k])}</span>
          <span className="text-kya-text-muted"> → </span>
          <span className="text-kya-status-low">{format(next[k])}</span>
        </div>
      ))}
    </pre>
  );
}

function format(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object' && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}
