import type { ReactNode } from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Render cell for a single row. Default: read `row[key]` and string-coerce. */
  render?: (row: T) => ReactNode;
  /** Optional fixed width hint (Tailwind class, e.g., `w-32`). */
  width?: string;
  /** Right-align numeric columns. */
  align?: 'left' | 'right';
}

/**
 * Lean table wrapper. Renders a single static table with no client-side
 * sorting or filtering — those happen at the server / URL-param level so
 * pages stay shareable. For interactive tables, the caller wraps this with
 * a client component that manages local state and re-fetches.
 */
export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  empty,
  rowHref,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  empty?: ReactNode;
  /** When set, every row is wrapped in a Next.js Link — navigation is
   *  via clicking a link inside the row (cleaner than an onClick handler). */
  rowHref?: (row: T) => string;
}) {
  return (
    <div className="border border-kya-border-default overflow-x-auto">
      <table className="w-full kya-data text-sm">
        <thead className="bg-kya-bg-secondary">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`text-left px-3 py-2 font-normal text-kya-text-secondary ${c.width ?? ''} ${c.align === 'right' ? 'text-right' : ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-6 text-center text-kya-text-muted"
              >
                {empty ?? 'no rows'}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const cells = columns.map((c) => {
                const content = c.render
                  ? c.render(row)
                  : String((row as Record<string, unknown>)[c.key] ?? '');
                return (
                  <td
                    key={c.key}
                    className={`px-3 py-1.5 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}
                  >
                    {content}
                  </td>
                );
              });
              const href = rowHref?.(row);
              return (
                <tr
                  key={row.id ?? i}
                  className={`border-t border-kya-border-default ${href ? 'hover:bg-kya-bg-tertiary' : ''}`}
                >
                  {cells}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
