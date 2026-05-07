'use client';

import { useState } from 'react';

interface RegenerateFunctionDialogProps {
  functionName: string;
  onClose: () => void;
  onRegenerate: (feedback: string) => void;
}

export function RegenerateFunctionDialog({ functionName, onClose, onRegenerate }: RegenerateFunctionDialogProps) {
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 1500));
    onRegenerate(feedback);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg w-full max-w-md p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Regenerate Function</h2>
          <p className="text-xs font-mono text-muted-foreground mt-1">{functionName}</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            What should change? <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="e.g. Add retry logic for the email send, return the updated score in the response, add input validation for negative scores…"
            className="w-full h-28 text-xs border border-border rounded-md px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2 text-xs text-amber-800 dark:text-amber-400">
          Server-side code regeneration affects a running function. Deployment is a separate step.
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={isSubmitting} className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted disabled:opacity-50">Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md disabled:opacity-50">
            {isSubmitting ? 'Regenerating…' : '↻ Regenerate'}
          </button>
        </div>
      </div>
    </div>
  );
}
