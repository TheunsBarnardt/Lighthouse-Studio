'use client';

import { useState } from 'react';
import { Database, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { RegenerateSchemaDialog } from './dialogs/RegenerateSchemaDialog.js';

interface SynthesisState {
  id: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  databaseDriver: string;
  tableCount: number;
  coverageRate: number;
  piiPendingCount: number;
  coverageGaps: string[];
}

interface SchemaSynthesisPageProps {
  params: { prdId: string };
}

export default function SchemaSynthesisPage({ params }: SchemaSynthesisPageProps) {
  const { prdId } = params;

  const [driver, setDriver] = useState<'postgres' | 'mssql' | 'mongo'>('postgres');
  const [synthesis, setSynthesis] = useState<SynthesisState | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSynthesize = async () => {
    setIsSynthesizing(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/schema-synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prdArtifactId: prdId, databaseDriver: driver }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSynthesis({
        id: data.id,
        status: data.status,
        databaseDriver: data.synthesizedSchema.databaseDriver,
        tableCount: data.synthesizedSchema.tables.length,
        coverageRate: data.synthesizedSchema.coverageReport.coverageRate,
        piiPendingCount: data.synthesizedSchema.piiDetectionRecord.detections.filter(
          (d: { tableId: string; columnId: string }) => !data.synthesizedSchema.piiDetectionRecord.confirmations.some(
            (c: { tableId: string; columnId: string }) => c.tableId === d.tableId && c.columnId === d.columnId
          )
        ).length,
        coverageGaps: data.synthesizedSchema.coverageReport.prdEntitiesUncovered.map((e: { entityName: string }) => e.entityName),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Synthesis failed');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleApply = async () => {
    if (!synthesis) return;
    try {
      const res = await fetch(`/api/v1/schema-synthesis/${synthesis.id}/apply`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      const { schemaId } = await res.json();
      window.location.href = `/schema-designer/${schemaId}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apply failed');
    }
  };

  const handleSubmit = async () => {
    if (!synthesis) return;
    try {
      const res = await fetch(`/api/v1/schema-synthesis/${synthesis.id}/submit`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      setSynthesis(prev => prev ? { ...prev, status: 'pending_approval' } : prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    }
  };

  if (!synthesis) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900">Stage 4: Schema Synthesis</h1>
            <p className="mt-1 text-sm text-gray-500">
              The AI will synthesize a complete database schema from your approved PRD.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Target Database</label>
              <div className="flex gap-3">
                {(['postgres', 'mssql', 'mongo'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDriver(d)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      driver === d ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <Database className="w-4 h-4 mx-auto mb-1" />
                    {d === 'postgres' ? 'PostgreSQL' : d === 'mssql' ? 'SQL Server' : 'MongoDB'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSynthesize}
              disabled={isSynthesizing}
              className="w-full py-3 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSynthesizing ? 'Synthesizing schema…' : 'Synthesize Schema'}
            </button>

            {isSynthesizing && (
              <div className="text-xs text-gray-500 text-center space-y-1">
                <div>Extracting entities from PRD…</div>
                <div>Generating table definitions…</div>
                <div>Modeling relationships…</div>
                <div>Detecting PII…</div>
                <div>Recommending indexes…</div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
          )}
        </div>
      </div>
    );
  }

  const coveragePct = Math.round(synthesis.coverageRate * 100);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Schema Synthesis Complete</h1>
            <p className="text-sm text-gray-500 mt-0.5">Review the synthesis summary, then open in Schema Designer</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRegenerateDialog(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" /> Regenerate
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Open in Schema Designer →
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{synthesis.tableCount}</div>
            <div className="text-sm text-gray-500">Tables generated</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`text-2xl font-bold ${coveragePct >= 90 ? 'text-green-600' : 'text-yellow-600'}`}>
              {coveragePct}%
            </div>
            <div className="text-sm text-gray-500">PRD entity coverage</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`text-2xl font-bold ${synthesis.piiPendingCount > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
              {synthesis.piiPendingCount}
            </div>
            <div className="text-sm text-gray-500">PII to confirm</div>
          </div>
        </div>

        {/* Coverage gaps */}
        {synthesis.coverageGaps.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-yellow-800">Coverage gaps</div>
                <div className="text-xs text-yellow-700 mt-1">
                  These PRD entities have no corresponding table: {synthesis.coverageGaps.join(', ')}.
                  Review in Schema Designer and add tables if needed.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PII notice */}
        {synthesis.piiPendingCount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-blue-800">PII detected — confirmation needed</div>
                <div className="text-xs text-blue-700 mt-1">
                  {synthesis.piiPendingCount} column(s) were flagged as containing PII.
                  Confirm or reject each detection in Schema Designer's PII Confirmation panel.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        {synthesis.status === 'draft' && (
          <button
            onClick={handleSubmit}
            className="w-full py-3 px-4 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700"
          >
            Submit for Approval
          </button>
        )}
        {synthesis.status === 'pending_approval' && (
          <div className="flex items-center gap-2 justify-center py-3 text-sm text-gray-500">
            <CheckCircle className="w-4 h-4 text-green-500" /> Submitted for approval
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
        )}
      </div>

      {showRegenerateDialog && (
        <RegenerateSchemaDialog
          isSynthesizing={isSynthesizing}
          onConfirm={async (feedback) => {
            if (!synthesis) return;
            setIsSynthesizing(true);
            try {
              const res = await fetch(`/api/v1/schema-synthesis/${synthesis.id}/regenerate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedback }),
              });
              if (!res.ok) throw new Error(await res.text());
              setSynthesis(prev => prev ? { ...prev } : prev);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Regeneration failed');
            } finally {
              setIsSynthesizing(false);
              setShowRegenerateDialog(false);
            }
          }}
          onClose={() => setShowRegenerateDialog(false)}
        />
      )}
    </div>
  );
}
