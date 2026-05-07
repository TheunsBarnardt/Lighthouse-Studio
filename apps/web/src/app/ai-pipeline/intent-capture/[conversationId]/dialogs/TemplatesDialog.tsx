'use client';

import { X, Search, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface TemplatesDialogProps {
  onSelectTemplate: (templateId: string) => void;
  onStartBlank: () => void;
  onClose: () => void;
}

// eslint-disable-next-line no-restricted-syntax -- client-side
const WORKSPACE_ID = process.env['NEXT_PUBLIC_DEFAULT_WORKSPACE_ID'] ?? 'default';

const CATEGORY_LABELS: Record<string, string> = {
  business: 'Business',
  content: 'Content',
  productivity: 'Productivity',
  commerce: 'Commerce',
  internal: 'Internal Tools',
  'customer-facing': 'Customer-Facing',
  technical: 'Technical',
  mobile: 'Mobile',
  analytics: 'Analytics',
  migration: 'Migration',
};

export function TemplatesDialog({ onSelectTemplate, onStartBlank, onClose }: TemplatesDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void fetch(`/api/v1/ai/intent-capture/templates?workspaceId=${WORKSPACE_ID}`)
      .then((r) => r.json())
      .then((data: { items?: Template[] }) => {
        setTemplates(data.items ?? []);
        setIsLoading(false);
        return undefined;
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const filtered = templates.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Choose a Template
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Loading templates…</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    onSelectTemplate(template.id);
                  }}
                  className="text-left p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {template.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {template.description}
                      </p>
                      <span className="text-xs mt-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded inline-block">
                        {CATEGORY_LABELS[template.category] ?? template.category}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onStartBlank}
            className="w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-gray-400 dark:hover:border-gray-600"
          >
            Start with a blank conversation →
          </button>
        </div>
      </div>
    </div>
  );
}
