import type { ReactNode } from 'react';

export default function DataManagementLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-full flex-col">{children}</div>;
}
