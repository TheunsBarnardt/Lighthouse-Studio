'use client';

import { useMemo } from 'react';

import type { StorageBrowserApi } from '@/components/storage-browser/StorageBrowser';

import { StorageBrowser } from '@/components/storage-browser/StorageBrowser';

// Workspace ID is normally extracted from the URL or session context.
// For the initial implementation, we read it from the query string.
const WORKSPACE_ID = 'default';

function buildApi(workspaceId: string): StorageBrowserApi {
  const base = `/api/v1/data/${workspaceId}/storage`;

  async function json<T>(url: string, opts?: RequestInit): Promise<T> {
    const r = await fetch(url, { ...opts, credentials: 'include' });
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`${String(r.status)}: ${body}`);
    }
    return r.json() as Promise<T>;
  }

  return {
    workspaceId,

    fetchBuckets: () => json(`${base}/buckets`),

    fetchFiles: (bucketId, folderPath, search) => {
      const params = new URLSearchParams({ bucketId });
      if (folderPath) params.set('folderPath', folderPath);
      if (search) params.set('search', search);
      return json(`${base}/files?${params.toString()}`);
    },

    fetchQuota: () =>
      json<{ quotaBytes: number; usedBytes: number }>(`${base}/quota`).then((q) => ({
        ...q,
        usedPercent: q.usedBytes / q.quotaBytes,
      })),

    uploadFiles: async (bucketId, folderPath, files) => {
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        form.append('bucketId', bucketId);
        if (folderPath) form.append('folderPath', folderPath);
        await fetch(`${base}/files`, {
          method: 'POST',
          body: form,
          credentials: 'include',
        });
      }
    },

    createBucket: (name, slug) =>
      json(`${base}/buckets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      }),

    createFolder: (bucketId, path) =>
      json(`${base}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketId, path }),
      }),

    renameFile: (fileId, newName) =>
      json(`${base}/files/${fileId}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName }),
      }),

    moveFiles: (fileIds, bucketId, folderPath) =>
      json(`${base}/files/bulk-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds, destination: { bucketId, folderPath } }),
      }),

    deleteFiles: (fileIds) =>
      json(`${base}/files/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds }),
      }),

    createSignedUrl: (fileId, ttlHours, limit) =>
      json<{ url: string }>(`${base}/files/${fileId}/signed-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttlSeconds: ttlHours * 3600, downloadLimit: limit }),
      }).then((r) => r.url),

    revokeSignedUrl: (urlId) => json(`${base}/signed-urls/${urlId}/revoke`, { method: 'POST' }),

    saveTags: (fileId, tags) =>
      json(`${base}/files/${fileId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      }),

    saveMetadata: (fileId, metadata) =>
      json(`${base}/files/${fileId}/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata }),
      }),

    getPreviewUrl: async (fileId) => {
      try {
        const result = await json<{ url: string }>(`${base}/files/${fileId}/preview-url`);
        return result.url;
      } catch {
        return undefined;
      }
    },
  };
}

export default function StoragePage() {
  const api = useMemo(() => buildApi(WORKSPACE_ID), []);

  return <StorageBrowser api={api} />;
}
