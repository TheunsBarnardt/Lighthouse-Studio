'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface RegenerateDialogProps {
  category?: string;
  isGenerating: boolean;
  onConfirm: (category: string | undefined, feedback: string) => void;
  onClose: () => void;
}

export function RegenerateDialog({ category, isGenerating, onConfirm, onClose }: RegenerateDialogProps) {
  const [feedback, setFeedback] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            {category ? `Regenerate ${category}` : 'Regenerate All Tokens'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {category
            ? `AI will regenerate only the ${category} tokens. All other tokens remain unchanged.`
            : 'AI will regenerate the complete token set. All manual edits will be replaced.'
          }
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Feedback (optional)
          </label>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="e.g. 'more muted and professional' or 'lighter feel with warmer tones'"
            rows={3}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(category, feedback)}
            disabled={isGenerating}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isGenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
      </div>
    </div>
  );
}
