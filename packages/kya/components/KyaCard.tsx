/**
 * Generic panel container — thin border, no rounded corners, no shadow,
 * subtle title bar. The "card" terminology is loose; the spec's KYA Card
 * is composed from many of these.
 */
export function KyaCard({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border border-kya-border-default bg-kya-bg-secondary ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between px-3 py-2 border-b border-kya-border-default">
          {title && (
            <h2 className="kya-data text-xs uppercase tracking-wider text-kya-text-secondary">
              {title}
            </h2>
          )}
          {action && <div className="kya-data text-xs">{action}</div>}
        </header>
      )}
      <div className="px-3 py-2">{children}</div>
    </section>
  );
}
