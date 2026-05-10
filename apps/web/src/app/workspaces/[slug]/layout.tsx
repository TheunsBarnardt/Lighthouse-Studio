import type { ReactNode } from 'react';

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <div className="pg-page">{children}</div>;
}
