'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { MongoEditor } from './components/editor/MongoEditor';
import { SqlEditor } from './components/editor/SqlEditor';
import { ConfirmWriteQueryDialog } from './components/dialogs/ConfirmWriteQueryDialog';
import { SaveQueryDialog } from './components/dialogs/SaveQueryDialog';
import { ExplainPanel } from './components/panels/ExplainPanel';
import { HistoryPanel } from './components/panels/HistoryPanel';
import { ParametersPanel } from './components/panels/ParametersPanel';
import { ResultsPanel } from './components/panels/ResultsPanel';
import { SavedQueriesPanel } from './components/panels/SavedQueriesPanel';
import { SchemaPanel } from './components/panels/SchemaPanel';

const DEFAULT_WORKSPACE_ID = process.env['NEXT_PUBLIC_DEFAULT_WORKSPACE_ID'] ?? 'default';

type Language = 'sql_postgres' | 'sql_mssql' | 'mongo_aggregate' | 'mongo_find';
type SidebarTab = 'schema' | 'history' | 'saved';
type BottomTab = 'results' | 'parameters' | 'explain';
type RunMode = 'read' | 'write';

interface Column {
  name: string;
  type?: string;
}

interface QueryResult {
  rows: Record<string, unknown>[];
  columns: Column[];
  rowCount: number;
  truncated: boolean;
  durationMs: number;
}

interface ExplainResult {
  plan: unknown;
  format: 'json' | 'xml' | 'text';
  durationMs: number;
}

interface ConfirmState {
  statementCount: number;
  affectedTables: string[];
  hasWriteStatements: boolean;
}

function extractParams(query: string, language: Language): string[] {
  if (language === 'mongo_aggregate' || language === 'mongo_find') {
    return Array.from(new Set([...query.matchAll(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((m) => m[1] ?? '')));
  }
  return Array.from(new Set([...query.matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((m) => m[1] ?? '')));
}

export default function QueryConsolePage() {
  const params = useParams<{ schemaSlug: string }>();
  const workspaceId = DEFAULT_WORKSPACE_ID;

  const [language, setLanguage] = useState<Language>('sql_postgres');
  const [query, setQuery] = useState('SELECT 1;');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [runMode] = useState<RunMode>('read');

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('schema');
  const [bottomTab, setBottomTab] = useState<BottomTab>('results');

  const [result, setResult] = useState<QueryResult | null>(null);
  const [explainResult, setExplainResult] = useState<ExplainResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const pendingConfirmRef = useRef(false);

  // History + saved queries
  const [history, setHistory] = useState<{ id: string; queryText: string; queryLanguage: string; status: string; durationMs: number; createdAt: string }[]>([]);
  const [savedQueries, setSavedQueries] = useState<{ id: string; name: string; description?: string | null; queryText: string; queryLanguage: string; folderPath?: string | null; shared: boolean }[]>([]);

  const paramNames = extractParams(query, language);

  const refreshHistory = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/data/${workspaceId}/console/history`);
      if (r.ok) {
        const data = await r.json() as { items?: typeof history };
        setHistory(data.items ?? []);
      }
    } catch { /* ignore */ }
  }, [workspaceId]);

  const refreshSaved = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/data/${workspaceId}/console/saved?includeShared=true`);
      if (r.ok) {
        const data = await r.json() as { items?: typeof savedQueries };
        setSavedQueries(data.items ?? []);
      }
    } catch { /* ignore */ }
  }, [workspaceId]);

  useEffect(() => {
    void refreshHistory();
    void refreshSaved();
  }, [refreshHistory, refreshSaved]);

  async function executeQuery(confirmed = false) {
    setRunning(true);
    setError(null);
    try {
      const body = {
        workspaceSlug: params.schemaSlug,
        databaseDriver: language.startsWith('sql_postgres') ? 'postgres' : language.startsWith('sql_mssql') ? 'mssql' : 'mongo',
        query,
        language,
        parameters: Object.fromEntries(Object.entries(paramValues).map(([k, v]) => [k, v])),
        confirmed: confirmed || undefined,
      };

      const res = await fetch(`/api/v1/data/${workspaceId}/console/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json() as { kind?: string; rows?: Record<string, unknown>[]; columns?: Column[]; rowCount?: number; truncated?: boolean; durationMs?: number; statementCount?: number; affectedTables?: string[]; hasWriteStatements?: boolean; error?: string };

      if (!res.ok) {
        setError(data.error ?? 'Query failed');
      } else if (data.kind === 'confirmation_required') {
        setConfirmState({
          statementCount: data.statementCount ?? 1,
          affectedTables: data.affectedTables ?? [],
          hasWriteStatements: data.hasWriteStatements ?? true,
        });
      } else {
        setResult({
          rows: data.rows ?? [],
          columns: data.columns ?? [],
          rowCount: data.rowCount ?? 0,
          truncated: data.truncated ?? false,
          durationMs: data.durationMs ?? 0,
        });
        setBottomTab('results');
        void refreshHistory();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  async function explainQuery() {
    setRunning(true);
    setError(null);
    try {
      const body = {
        workspaceSlug: params.schemaSlug,
        databaseDriver: language.startsWith('sql_postgres') ? 'postgres' : language.startsWith('sql_mssql') ? 'mssql' : 'mongo',
        query,
        language,
        parameters: paramValues,
      };

      const res = await fetch(`/api/v1/data/${workspaceId}/console/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json() as { plan?: unknown; format?: 'json' | 'xml' | 'text'; durationMs?: number; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Explain failed');
      } else {
        setExplainResult({ plan: data.plan ?? {}, format: data.format ?? 'json', durationMs: data.durationMs ?? 0 });
        setBottomTab('explain');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  async function saveQuery(opts: { name: string; description: string; folderPath: string; shared: boolean; sharedCanRun: boolean }) {
    await fetch(`/api/v1/data/${workspaceId}/console/saved`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...opts, queryText: query, queryLanguage: language }),
    });
    setSaveDialogOpen(false);
    void refreshSaved();
  }

  void runMode;

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-lg border bg-card">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <select
          value={language}
          onChange={(e) => { setLanguage(e.target.value as Language); }}
          className="rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Query language"
        >
          <option value="sql_postgres">PostgreSQL</option>
          <option value="sql_mssql">MSSQL / T-SQL</option>
          <option value="mongo_aggregate">MongoDB Aggregate</option>
          <option value="mongo_find">MongoDB Find</option>
        </select>

        <button
          type="button"
          onClick={() => { void executeQuery(); }}
          disabled={running}
          className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {running ? 'Running…' : 'Run'}
        </button>

        <button
          type="button"
          onClick={() => { void explainQuery(); }}
          disabled={running}
          className="rounded border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
        >
          Explain
        </button>

        <button
          type="button"
          onClick={() => { setSaveDialogOpen(true); }}
          className="rounded border px-3 py-1 text-sm hover:bg-muted"
        >
          Save
        </button>

        {error && (
          <span className="ml-2 rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
            {error}
          </span>
        )}
      </div>

      {/* Main content: sidebar + editor + bottom panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="flex w-64 shrink-0 flex-col border-r">
          <div className="flex border-b">
            {(['schema', 'history', 'saved'] as SidebarTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setSidebarTab(tab); }}
                className={`flex-1 py-1.5 text-xs font-medium capitalize ${sidebarTab === tab ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            {sidebarTab === 'schema' && (
              <SchemaPanel
                tables={[]}
                onInsert={(text) => { setQuery((q) => `${q}${text}`); }}
              />
            )}
            {sidebarTab === 'history' && (
              <HistoryPanel
                entries={history}
                onSelect={(q, lang) => { setQuery(q); setLanguage(lang as Language); }}
              />
            )}
            {sidebarTab === 'saved' && (
              <SavedQueriesPanel
                queries={savedQueries}
                onSelect={(q, lang) => { setQuery(q); setLanguage(lang as Language); }}
              />
            )}
          </div>
        </div>

        {/* Editor + bottom panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Editor */}
          <div className="flex-1 overflow-hidden">
            {language === 'mongo_aggregate' || language === 'mongo_find' ? (
              <MongoEditor value={query} onChange={setQuery} onRun={() => { void executeQuery(); }} />
            ) : (
              <SqlEditor
                value={query}
                onChange={setQuery}
                language={language}
                onRun={() => { void executeQuery(); }}
                workspaceId={workspaceId}
                schemaId={params.schemaSlug}
              />
            )}
          </div>

          {/* Bottom panel */}
          <div className="flex h-56 shrink-0 flex-col border-t">
            <div className="flex border-b">
              {(['results', 'parameters', 'explain'] as BottomTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setBottomTab(tab); }}
                  className={`px-4 py-1.5 text-xs font-medium capitalize ${bottomTab === tab ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {tab}
                  {tab === 'parameters' && paramNames.length > 0 && (
                    <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">{paramNames.length}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              {bottomTab === 'results' && result ? (
                <ResultsPanel
                  rows={result.rows}
                  columns={result.columns}
                  rowCount={result.rowCount}
                  truncated={result.truncated}
                  durationMs={result.durationMs}
                />
              ) : bottomTab === 'results' ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Run a query to see results (Cmd+Enter)
                </div>
              ) : null}

              {bottomTab === 'parameters' && (
                <ParametersPanel
                  paramNames={paramNames}
                  values={paramValues}
                  onChange={(name, value) => { setParamValues((prev) => ({ ...prev, [name]: value })); }}
                />
              )}

              {bottomTab === 'explain' && explainResult ? (
                <ExplainPanel
                  plan={explainResult.plan}
                  format={explainResult.format}
                  durationMs={explainResult.durationMs}
                />
              ) : bottomTab === 'explain' ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Click Explain to see the query execution plan
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <SaveQueryDialog
        open={saveDialogOpen}
        onClose={() => { setSaveDialogOpen(false); }}
        onSave={(opts) => { void saveQuery(opts); }}
      />

      <ConfirmWriteQueryDialog
        open={confirmState !== null}
        statementCount={confirmState?.statementCount ?? 1}
        affectedTables={confirmState?.affectedTables ?? []}
        hasWriteStatements={confirmState?.hasWriteStatements ?? true}
        onConfirm={() => {
          pendingConfirmRef.current = true;
          setConfirmState(null);
          void executeQuery(true);
        }}
        onCancel={() => { setConfirmState(null); }}
      />
    </div>
  );
}
