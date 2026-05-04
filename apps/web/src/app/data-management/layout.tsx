'use client';

import type { ReactNode } from 'react';

export default function DataManagementLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card p-4 shadow-sm">
        <h1 className="text-2xl font-bold">Data Management</h1>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
