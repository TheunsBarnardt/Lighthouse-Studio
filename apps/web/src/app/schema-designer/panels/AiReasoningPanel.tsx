'use client';

import { Lightbulb, Link2 } from 'lucide-react';

interface AiReasoningPanelProps {
  reasoning: string;
  prdReferences?: string[];
  title?: string;
}

export function AiReasoningPanel({ reasoning, prdReferences, title = 'AI Reasoning' }: AiReasoningPanelProps) {
  if (!reasoning) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
      <div className="flex items-start gap-2">
        <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-amber-800 mb-1">{title}</div>
          <p className="text-xs text-amber-700 leading-relaxed">{reasoning}</p>
          {prdReferences && prdReferences.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {prdReferences.map((ref, i) => (
                <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                  <Link2 className="w-3 h-3" /> {ref}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
