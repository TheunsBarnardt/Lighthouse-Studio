'use client';

import { useState } from 'react';
import { ProjectTreePanel } from './panels/ProjectTreePanel.js';
import { CodeViewerPanel } from './panels/CodeViewerPanel.js';
import { PreviewPanel } from './panels/PreviewPanel.js';
import { RegenerateComponentDialog } from './dialogs/RegenerateComponentDialog.js';
import { ExportProjectDialog } from './dialogs/ExportProjectDialog.js';
import { ProjectStatusView } from './views/ProjectStatusView.js';

type ViewMode = 'code-review' | 'status';

const MOCK_FILE = {
  path: 'src/pages/ContactsListPage.tsx',
  content: `'use client';

import { useQuery } from '@tanstack/react-query';
import { platform } from '../lib/platform';
import { usePermissions } from '../hooks/usePermissions';

export function ContactsListPage() {
  const { can } = usePermissions();
  const { data, isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => platform.data('contacts').list({ limit: 50 }),
  });

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Contacts</h1>
        {can('contact.create') && (
          <a href="/contacts/new" className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
            New Contact
          </a>
        )}
      </div>
      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 font-medium">Name</th>
              <th className="text-left py-2 font-medium">Email</th>
              <th className="text-left py-2 font-medium">Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((contact: any) => (
              <tr key={contact.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2">{contact.full_name}</td>
                <td className="py-2">{contact.email}</td>
                <td className="py-2">{new Date(contact.created_at).toLocaleDateString()}</td>
                <td className="py-2 text-right">
                  <a href={\`/contacts/\${contact.id}\`} className="text-primary text-xs">View</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}`,
};

export default function UiGenerationPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('code-review');
  const [selectedFile, setSelectedFile] = useState(MOCK_FILE.path);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [approvedCount, setApprovedCount] = useState(0);
  const totalComponents = 12;

  async function handleGenerate() {
    setIsGenerating(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsGenerating(false);
    setGenerated(true);
  }

  if (!generated) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="max-w-md text-center space-y-4 p-6">
          <div className="text-4xl">⚡</div>
          <h2 className="text-lg font-semibold text-foreground">Stage 6 — UI Generation</h2>
          <p className="text-sm text-muted-foreground">
            Generate a complete React application from your PRD, design tokens, and schema.
            All components will be accessible, type-safe, and use the platform SDK.
          </p>
          <div className="text-xs text-muted-foreground bg-muted rounded-lg p-3 text-left space-y-1">
            <p>✓ PRD approved (13 sections)</p>
            <p>✓ Design tokens approved</p>
            <p>✓ Schema approved (8 tables)</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-6 py-2 bg-primary text-primary-foreground text-sm rounded-md disabled:opacity-50"
          >
            {isGenerating ? 'Generating UI…' : 'Generate UI'}
          </button>
          {isGenerating && (
            <p className="text-xs text-muted-foreground">
              Generating 12 components across 8 pages. Estimated: 3–5 minutes.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 py-3 flex items-center justify-between bg-background">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-foreground">Stage 6 — UI Generation</span>
          <span className="text-xs text-muted-foreground">{approvedCount}/{totalComponents} approved</span>
          <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${(approvedCount / totalComponents) * 100}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'code-review' ? 'status' : 'code-review')}
            className="px-3 py-1.5 text-xs border border-border rounded-md"
          >
            {viewMode === 'code-review' ? 'Project Status' : 'Code Review'}
          </button>
          <button
            onClick={() => setShowRegenerate(true)}
            className="px-3 py-1.5 text-xs border border-border rounded-md"
          >
            Regenerate
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md"
          >
            Export Project
          </button>
        </div>
      </div>

      {viewMode === 'status' ? (
        <ProjectStatusView totalComponents={totalComponents} approvedCount={approvedCount} onApproveAll={() => setApprovedCount(totalComponents)} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 border-r border-border flex-shrink-0 overflow-auto">
            <ProjectTreePanel selectedFile={selectedFile} onSelectFile={setSelectedFile} />
          </div>
          <div className="flex-1 overflow-hidden flex">
            <div className="flex-1 overflow-auto">
              <CodeViewerPanel
                filePath={selectedFile}
                content={MOCK_FILE.content}
                onApprove={() => setApprovedCount(c => Math.min(c + 1, totalComponents))}
                onRegenerate={() => setShowRegenerate(true)}
              />
            </div>
            <div className="w-80 border-l border-border flex-shrink-0 overflow-hidden">
              <PreviewPanel filePath={selectedFile} />
            </div>
          </div>
        </div>
      )}

      {showRegenerate && (
        <RegenerateComponentDialog
          componentName="ContactsListPage"
          onClose={() => setShowRegenerate(false)}
          onRegenerate={() => setShowRegenerate(false)}
        />
      )}
      {showExport && (
        <ExportProjectDialog
          projectId="proj-123"
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
