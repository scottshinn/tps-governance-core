import type { Metadata } from 'next';

import { CommandPalette } from '@/components/CommandPalette';
import { Sidebar } from '@/components/Sidebar';

import './globals.css';

export const metadata: Metadata = {
  title: 'TPS KYA',
  description:
    'Know Your Agent — visual governance control plane for AI agent deployments',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
        <CommandPalette />
      </body>
    </html>
  );
}
