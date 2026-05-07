'use client';

import { useState } from 'react';

interface RegenerateComponentDialogProps {
  componentName: string;
  onClose: () => void;
  onRegenerate: (feedback: string) => void;
}

export function RegenerateComponentDialog({ componentName, onClose, onRegenerate }: RegenerateComponentDialogProps) {
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
          <h2 className="text-sm font-semibold text-foreground">Regenerate Component</h2>
          <p className="text-xs text-muted-foreground mt-1">{componentName}</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground">
            What should be changed? <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="e.g. Add a search bar above the table, show status badges in the Status column, use a date picker for the date filter…"
            className="w-full h-28 text-xs border border-border rounded-md px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="bg-muted/50 rounded-md px-3 py-2 text-xs text-muted-foreground">
          The component will be regenerated using the original PRD, schema, and design tokens plus your feedback above.
          Previous code will be replaced.
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Regenerating…' : '↻ Regenerate'}
          </button>
        </div>
      </div>
    </div>
  );
}
