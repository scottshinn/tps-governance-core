'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  Compass,
  GitBranch,
  LayoutDashboard,
  ScrollText,
  ShieldAlert,
  Users,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  enabled: boolean;
  hint?: string;
}

const PRIMARY: NavItem[] = [
  { href: '/agents', label: 'AGENTS', icon: Users, enabled: true },
  { href: '/audit', label: 'AUDIT', icon: ScrollText, enabled: true },
];

const PHASE2: NavItem[] = [
  { href: '/topology', label: 'TOPO', icon: GitBranch, enabled: false, hint: 'soon' },
  { href: '/resources', label: 'RES', icon: Compass, enabled: false, hint: 'soon' },
  { href: '/rules', label: 'RULES', icon: ShieldAlert, enabled: false, hint: 'soon' },
  { href: '/dashboard', label: 'DASH', icon: LayoutDashboard, enabled: false, hint: 'soon' },
  { href: '/compliance', label: 'COMPLY', icon: ClipboardList, enabled: false, hint: 'soon' },
];

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <aside className="w-[200px] flex-none flex flex-col border-r border-kya-border-default bg-kya-bg-secondary">
      <div className="flex h-12 items-center justify-between px-4 border-b border-kya-border-default">
        <span className="kya-data text-lg text-kya-accent-primary">TPS</span>
        <kbd>⌘K</kbd>
      </div>
      <nav className="flex-1 py-2 kya-data text-sm">
        <NavGroup items={PRIMARY} isActive={isActive} />
        <div className="my-2 mx-4 border-t border-kya-border-default" />
        <NavGroup items={PHASE2} isActive={isActive} />
      </nav>
      <div className="px-4 py-2 border-t border-kya-border-default kya-data text-xs text-kya-text-muted">
        v0.0.1
      </div>
    </aside>
  );
}

function NavGroup({
  items,
  isActive,
}: {
  items: NavItem[];
  isActive: (href: string) => boolean;
}) {
  return (
    <ul>
      {items.map((item) => {
        const active = item.enabled && isActive(item.href);
        const Icon = item.icon;
        const colorCls = !item.enabled
          ? 'text-kya-text-muted cursor-not-allowed'
          : active
            ? 'text-kya-accent-primary bg-kya-bg-tertiary'
            : 'text-kya-text-secondary hover:text-kya-text-primary hover:bg-kya-bg-tertiary';
        const Inner = (
          <span
            className={`flex items-center gap-2 px-4 py-1.5 ${colorCls}`}
          >
            <Icon size={14} />
            <span className="flex-1">{item.label}</span>
            {item.hint && (
              <span className="text-xs text-kya-text-muted">{item.hint}</span>
            )}
          </span>
        );
        return (
          <li key={item.href}>
            {item.enabled ? (
              <Link href={item.href}>{Inner}</Link>
            ) : (
              <span aria-disabled="true">{Inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
