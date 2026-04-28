import Link from 'next/link';

/**
 * Clickable monospace link to an entity. Defaults to accent-green; falls
 * back to muted when `dim` is set (used for inactive / decommissioned
 * references in tables).
 */
export function EntityLink({
  href,
  children,
  dim = false,
}: {
  href: string;
  children: React.ReactNode;
  dim?: boolean;
}) {
  const cls = dim
    ? 'text-kya-text-muted hover:text-kya-text-secondary'
    : 'text-kya-accent-primary hover:text-kya-accent-secondary';
  return (
    <Link href={href} className={`kya-data ${cls} hover:underline underline-offset-2`}>
      {children}
    </Link>
  );
}
