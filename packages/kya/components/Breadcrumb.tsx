import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Compact breadcrumb trail. Last crumb renders without a link.
 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1 kya-data text-xs text-kya-text-secondary">
      {items.map((c, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex items-center gap-1">
            {c.href && !isLast ? (
              <Link
                href={c.href}
                className="hover:text-kya-accent-primary hover:underline underline-offset-2"
              >
                {c.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-kya-text-primary' : ''}>{c.label}</span>
            )}
            {!isLast && <ChevronRight size={12} className="text-kya-text-muted" />}
          </span>
        );
      })}
    </nav>
  );
}
