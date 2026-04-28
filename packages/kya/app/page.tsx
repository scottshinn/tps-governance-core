import { redirect } from 'next/navigation';

// Per CLAUDE.md application structure — root redirects to the agent registry.
export default function RootPage() {
  redirect('/agents');
}
