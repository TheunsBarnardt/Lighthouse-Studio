'use client';

import { X } from 'lucide-react';

interface ExportDialogProps {
  onExport: (format: string) => void;
  onClose: () => void;
}

const FORMATS = [
  { id: 'css', label: 'CSS Variables', description: 'Ready-to-use CSS custom properties (:root { --color-... })', filename: 'tokens.css' },
  { id: 'tailwind', label: 'Tailwind Config', description: 'A complete tailwind.config.js with your tokens', filename: 'tailwind.config.js' },
  { id: 'json_dtcg', label: 'JSON (W3C DTCG)', description: 'W3C Design Tokens Community Group format; works with Style Dictionary and Figma plugins', filename: 'tokens.json' },
  { id: 'typescript', label: 'TypeScript', description: 'Typed const declarations for CSS-in-JS or direct import', filename: 'tokens.ts' },
];

export function ExportDialog({ onExport, onClose }: ExportDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Export Tokens</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2">
          {FORMATS.map(fmt => (
            <button
              key={fmt.id}
              onClick={() => { onExport(fmt.id); onClose(); }}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <div className="text-sm font-medium text-gray-900">{fmt.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{fmt.description}</div>
              <div className="text-xs text-gray-400 mt-1 font-mono">{fmt.filename}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
