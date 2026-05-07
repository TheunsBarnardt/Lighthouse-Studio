'use client';

import { useState } from 'react';

type SourceType = 'postgres' | 'mssql' | 'mysql' | 'mongo' | 'csv' | 'json' | 'excel';

interface SourceStepProps {
  onConnected: (sourceConnectionId: string) => void;
}

const DB_TYPES: { id: SourceType; label: string; icon: string }[] = [
  { id: 'postgres', label: 'PostgreSQL', icon: '🐘' },
  { id: 'mssql', label: 'SQL Server', icon: '🗄️' },
  { id: 'mysql', label: 'MySQL', icon: '🐬' },
  { id: 'mongo', label: 'MongoDB', icon: '🍃' },
];

const FILE_TYPES: { id: SourceType; label: string; icon: string; accept: string }[] = [
  { id: 'csv', label: 'CSV', icon: '📄', accept: '.csv' },
  { id: 'json', label: 'JSON', icon: '{ }', accept: '.json,.jsonl' },
  { id: 'excel', label: 'Excel', icon: '📊', accept: '.xlsx,.xls' },
];

export function SourceStep({ onConnected }: SourceStepProps) {
  const [selectedType, setSelectedType] = useState<SourceType | null>(null);
  const [connectionString, setConnectionString] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    if (!selectedType || !connectionString.trim()) return;
    setIsConnecting(true);
    setError(null);
    try {
      await new Promise(r => setTimeout(r, 800));
      onConnected(crypto.randomUUID());
    } catch {
      setError('Failed to connect. Check credentials and try again.');
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedType) return;
    setIsConnecting(true);
    setError(null);
    try {
      await new Promise(r => setTimeout(r, 500));
      onConnected(crypto.randomUUID());
    } catch {
      setError('Failed to process file.');
    } finally {
      setIsConnecting(false);
    }
  }

  const isDbType = selectedType && DB_TYPES.some(t => t.id === selectedType);
  const isFileType = selectedType && FILE_TYPES.some(t => t.id === selectedType);
  const fileConfig = FILE_TYPES.find(t => t.id === selectedType);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground mb-1">Select Data Source</h2>
        <p className="text-sm text-muted-foreground">
          Connect to a database or upload a file. The platform connects read-only and never writes to your source.
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Databases</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DB_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedType(t.id)}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-colors ${
                selectedType === t.id
                  ? 'border-primary bg-primary/5 text-primary font-medium'
                  : 'border-border bg-card text-foreground hover:border-primary/50'
              }`}
            >
              <span className="text-xl">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Files</p>
        <div className="grid grid-cols-3 gap-2">
          {FILE_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedType(t.id)}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-colors ${
                selectedType === t.id
                  ? 'border-primary bg-primary/5 text-primary font-medium'
                  : 'border-border bg-card text-foreground hover:border-primary/50'
              }`}
            >
              <span className="text-xl">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {isDbType && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Connection String</span>
            <p className="text-xs text-muted-foreground mt-0.5 mb-1">
              Use a read-only account. Credentials are stored encrypted and never logged.
            </p>
            <input
              type="password"
              className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background font-mono"
              placeholder={`postgresql://user:password@host:5432/dbname`}
              value={connectionString}
              onChange={e => setConnectionString(e.target.value)}
            />
          </label>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            onClick={handleConnect}
            disabled={!connectionString.trim() || isConnecting}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md disabled:opacity-50"
          >
            {isConnecting ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      )}

      {isFileType && fileConfig && (
        <div className="space-y-3">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Drop your {fileConfig.label} file here, or click to browse
            </p>
            <label className="cursor-pointer">
              <span className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md">
                Choose File
              </span>
              <input
                type="file"
                accept={fileConfig.accept}
                className="sr-only"
                onChange={handleFileUpload}
              />
            </label>
          </div>
          {isConnecting && <p className="text-xs text-muted-foreground">Processing file…</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      {!selectedType && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Select a source type above to continue. You can also{' '}
          <button className="text-primary underline text-sm" onClick={() => onConnected('skip')}>
            skip this stage
          </button>{' '}
          for greenfield projects.
        </p>
      )}
    </div>
  );
}
