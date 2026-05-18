'use client';

import { ChangeRequestsPanel } from './ChangeRequestsPanel';

export default function ChangeRequestsPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5">
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Change requests</h1>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          The bridge from production signals back into the AI pipeline. Each change request groups
          signals, suggests pipeline stages to re-engage, and tracks resolution.
        </div>
      </div>
      <div className="rounded-md border bg-card text-card-foreground">
        <ChangeRequestsPanel />
      </div>
    </div>
  );
}
