'use client';

import { SignalsListPanel } from './SignalsListPanel';

export default function SignalsPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5">
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Signals</h1>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          Errors, performance issues, user reports, and feature requests from deployed builds.
          Select signals and create a change request to route them back into the pipeline.
        </div>
      </div>
      <div className="rounded-md border bg-card text-card-foreground">
        <SignalsListPanel />
      </div>
    </div>
  );
}
