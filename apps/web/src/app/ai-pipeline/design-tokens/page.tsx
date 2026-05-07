'use client';

import { useState } from 'react';
import { BrandInputsPanel } from './panels/BrandInputsPanel.js';
import { PreviewPanel } from './panels/PreviewPanel.js';
import { TokenEditorPanel } from './panels/TokenEditorPanel.js';
import { RegenerateDialog } from './dialogs/RegenerateDialog.js';
import { ExportDialog } from './dialogs/ExportDialog.js';
import { ThemeSwitcher } from './dialogs/ThemeSwitcher.js';

interface DesignTokenSet {
  id: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  tokenSet: Record<string, unknown>;
  accessibilityReport?: { overallPass: boolean; passCount: number; failCount: number };
}

interface DesignTokensPageProps {
  params: { prdId: string };
}

export default function DesignTokensPage({ params }: DesignTokensPageProps) {
  const { prdId } = params;

  const [artifact, setArtifact] = useState<DesignTokenSet | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectedTokenPath, setSelectedTokenPath] = useState<string | null>(null);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [regenerateCategory, setRegenerateCategory] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (brandInputs: Record<string, unknown>) => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/design-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prdArtifactId: prdId, brandInputs }),
      });
      if (!res.ok) throw new Error(await res.text());
      setArtifact(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditToken = async (tokenPath: string, newValue: unknown) => {
    if (!artifact) return;
    try {
      const res = await fetch(`/api/v1/design-tokens/${artifact.id}/tokens`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenPath, newValue }),
      });
      if (!res.ok) throw new Error(await res.text());
      setArtifact(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Edit failed');
    }
  };

  const handleRegenerate = async (category: string | undefined, feedback: string) => {
    if (!artifact) return;
    setIsGenerating(true);
    try {
      const url = category
        ? `/api/v1/design-tokens/${artifact.id}/regenerate-category`
        : `/api/v1/design-tokens/${artifact.id}/regenerate`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, feedback }),
      });
      if (!res.ok) throw new Error(await res.text());
      setArtifact(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regeneration failed');
    } finally {
      setIsGenerating(false);
      setShowRegenerateDialog(false);
    }
  };

  const handleExport = async (format: string) => {
    if (!artifact) return;
    const res = await fetch(`/api/v1/design-tokens/${artifact.id}/export?format=${format}`);
    if (!res.ok) return;
    const { content, filename } = await res.json();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    if (!artifact) return;
    try {
      const res = await fetch(`/api/v1/design-tokens/${artifact.id}/submit`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      setArtifact(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    }
  };

  // No tokens yet — show brand inputs form
  if (!artifact) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900">Stage 3: Design Tokens</h1>
            <p className="mt-1 text-sm text-gray-500">
              Tell us about your brand and we'll generate a complete visual language for your app.
            </p>
          </div>
          <BrandInputsPanel onGenerate={handleGenerate} isGenerating={isGenerating} />
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-gray-900">Design Tokens</h1>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(artifact.status)}`}>
            {artifact.status}
          </span>
          {artifact.accessibilityReport && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${artifact.accessibilityReport.overallPass ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              WCAG AA: {artifact.accessibilityReport.passCount}/{artifact.accessibilityReport.passCount + artifact.accessibilityReport.failCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher theme={theme} onChange={setTheme} />
          <button
            onClick={() => { setRegenerateCategory(undefined); setShowRegenerateDialog(true); }}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Regenerate All
          </button>
          <button
            onClick={() => setShowExportDialog(true)}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Export
          </button>
          {artifact.status === 'draft' && (
            <button
              onClick={handleSubmit}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Submit for Approval
            </button>
          )}
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main preview */}
        <div className="flex-1 overflow-auto">
          <PreviewPanel
            tokenSet={artifact.tokenSet}
            theme={theme}
            onSelectToken={setSelectedTokenPath}
            selectedTokenPath={selectedTokenPath}
          />
        </div>

        {/* Token editor sidebar */}
        <div className="w-80 border-l bg-white overflow-auto flex-shrink-0">
          <TokenEditorPanel
            tokenSet={artifact.tokenSet}
            selectedTokenPath={selectedTokenPath}
            onSelectToken={setSelectedTokenPath}
            onEditToken={handleEditToken}
            onRegenerateCategory={(cat) => { setRegenerateCategory(cat); setShowRegenerateDialog(true); }}
          />
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-sm text-red-700">{error}</div>
      )}

      {showRegenerateDialog && (
        <RegenerateDialog
          category={regenerateCategory}
          isGenerating={isGenerating}
          onConfirm={handleRegenerate}
          onClose={() => setShowRegenerateDialog(false)}
        />
      )}
      {showExportDialog && (
        <ExportDialog onExport={handleExport} onClose={() => setShowExportDialog(false)} />
      )}
    </div>
  );
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-700';
    case 'pending_approval': return 'bg-yellow-100 text-yellow-700';
    case 'rejected': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}
