'use client';

import { useState } from 'react';

interface SharingDialogProps {
  fileId: string;
  filename: string;
  onCreateSignedUrl: (fileId: string, ttlHours: number, limit?: number) => Promise<string>;
  onRevokeSignedUrl: (urlId: string) => Promise<void>;
  signedUrls: Array<{
    id: string;
    expiresAt: string;
    downloadCount: number;
    downloadLimit?: number;
    revokedAt?: string;
  }>;
  onClose: () => void;
}

export function SharingDialog({
  fileId,
  filename,
  onCreateSignedUrl,
  onRevokeSignedUrl,
  signedUrls,
  onClose,
}: SharingDialogProps) {
  const [ttlHours, setTtlHours] = useState(1);
  const [limit, setLimit] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const url = await onCreateSignedUrl(
        fileId,
        ttlHours,
        limit ? parseInt(limit, 10) : undefined,
      );
      setNewUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Sharing options for ${filename}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-semibold">Share: {filename}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Create shareable link</h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="ttl" className="mb-1 block text-xs text-muted-foreground">
                  Expires after
                </label>
                <select
                  id="ttl"
                  value={ttlHours}
                  onChange={(e) => {
                    setTtlHours(Number(e.target.value));
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                >
                  <option value={1}>1 hour</option>
                  <option value={24}>24 hours</option>
                  <option value={168}>7 days</option>
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="dl-limit" className="mb-1 block text-xs text-muted-foreground">
                  Download limit (optional)
                </label>
                <input
                  id="dl-limit"
                  type="number"
                  min="1"
                  value={limit}
                  onChange={(e) => {
                    setLimit(e.target.value);
                  }}
                  placeholder="Unlimited"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                />
              </div>
            </div>
            <button
              onClick={() => {
                void handleCreate();
              }}
              disabled={loading}
              className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create link'}
            </button>
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
            {newUrl && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <p className="mb-1 text-xs font-medium text-primary">
                  Link created — copy it now (won't be shown again)
                </p>
                <input
                  readOnly
                  value={newUrl}
                  className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                  onClick={(e) => {
                    (e.target as HTMLInputElement).select();
                  }}
                />
              </div>
            )}
          </div>

          {signedUrls.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Existing links</h3>
              <ul className="max-h-40 overflow-y-auto space-y-1">
                {signedUrls.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
                  >
                    <div>
                      <p className={u.revokedAt ? 'line-through text-muted-foreground' : ''}>
                        Expires {new Date(u.expiresAt).toLocaleString()}
                      </p>
                      <p className="text-muted-foreground">
                        {String(u.downloadCount)} download{u.downloadCount !== 1 ? 's' : ''}
                        {u.downloadLimit !== undefined ? ` / ${String(u.downloadLimit)}` : ''}
                      </p>
                    </div>
                    {!u.revokedAt && (
                      <button
                        onClick={() => {
                          void onRevokeSignedUrl(u.id);
                        }}
                        className="text-destructive hover:underline"
                      >
                        Revoke
                      </button>
                    )}
                    {u.revokedAt && <span className="text-muted-foreground">Revoked</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
