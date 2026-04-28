import { Inbox } from 'lucide-react';

/**
 * "No data" placeholder. The icon defaults to `Inbox`; pass any Lucide
 * component to override.
 */
export function EmptyState({
  message,
  hint,
  icon: Icon = Inbox,
}: {
  message: string;
  hint?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-kya-text-muted">
      <Icon size={20} className="mb-2" />
      <div className="kya-data text-sm">{message}</div>
      {hint && <div className="kya-data text-xs mt-1">{hint}</div>}
    </div>
  );
}
