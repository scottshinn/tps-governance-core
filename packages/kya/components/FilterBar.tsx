'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import type { ChangeEvent } from 'react';

export interface SelectFilter<V extends string = string> {
  key: string;
  label: string;
  options: { value: V; label: string }[];
}

/**
 * Generic filter row backed by URL search params. Server Components read
 * `searchParams` and pass them to `TpsClient` for filtering — pages stay
 * bookmarkable and the back button works.
 */
export function FilterBar({
  filters,
  searchKey = 'search',
  resultCount,
}: {
  filters: SelectFilter[];
  searchKey?: string;
  resultCount?: number;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value === '') next.delete(key);
    else next.set(key, value);
    next.delete('cursor'); // any filter change resets pagination
    router.push(`?${next.toString()}`);
  }

  function clear() {
    router.push('?');
  }

  const hasActive =
    Array.from(params.keys()).filter((k) => k !== 'cursor').length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border border-kya-border-default bg-kya-bg-secondary kya-data text-xs">
      <div className="relative flex items-center">
        <Search size={12} className="absolute left-2 text-kya-text-muted" />
        <input
          type="search"
          placeholder="search..."
          defaultValue={params.get(searchKey) ?? ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) => update(searchKey, e.target.value)}
          className="pl-7 pr-2 py-1 bg-kya-bg-surface border border-kya-border-default text-kya-text-primary placeholder:text-kya-text-muted focus:border-kya-border-focus outline-none w-48 kya-data text-xs"
        />
      </div>
      {filters.map((f) => (
        <select
          key={f.key}
          value={params.get(f.key) ?? ''}
          onChange={(e) => update(f.key, e.target.value)}
          className="px-2 py-1 bg-kya-bg-surface border border-kya-border-default text-kya-text-primary focus:border-kya-border-focus outline-none kya-data text-xs"
        >
          <option value="">{f.label}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      {hasActive && (
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 text-kya-text-secondary hover:text-kya-accent-primary"
        >
          <X size={12} /> clear
        </button>
      )}
      {resultCount !== undefined && (
        <span className="ml-auto text-kya-text-muted">
          showing {resultCount}
        </span>
      )}
    </div>
  );
}
