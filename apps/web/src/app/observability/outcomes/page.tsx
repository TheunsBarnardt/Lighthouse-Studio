'use client';

import { OutcomeTrackingPanel } from './OutcomeTrackingPanel';

export default function OutcomesPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5">
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Outcome tracking</h1>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          Post-deployment metric deltas for resolved change requests. Surfaces regressions
          introduced by pipeline re-engagements.
        </div>
      </div>
      <div className="rounded-md border bg-card text-card-foreground">
        <OutcomeTrackingPanel />
      </div>
    </div>
  );
}
