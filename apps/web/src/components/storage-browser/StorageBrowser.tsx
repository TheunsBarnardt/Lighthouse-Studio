'use client';

import { useCallback, useEffect, useReducer, useState } from 'react';

import type { StorageEvent } from './realtime/StorageEventListener.js';
import type { BucketSummary, FileSummary, QuotaSummary, ViewMode } from './types.js';

import { CreateFolderDialog } from './dialogs/CreateFolderDialog.js';
import { MoveDialog } from './dialogs/MoveDialog.js';
import { PropertiesDialog } from './dialogs/PropertiesDialog.js';
import { RenameDialog } from './dialogs/RenameDialog.js';
import { SharingDialog } from './dialogs/SharingDialog.js';
import { UploadDialog } from './dialogs/UploadDialog.js';
import { QuotaPanel } from './panels/QuotaPanel.js';
import { SearchPanel } from './panels/SearchPanel.js';
import { StorageEventListener } from './realtime/StorageEventListener.js';
import { GridView } from './views/GridView.js';
import { ListView } from './views/ListView.js';
import { PreviewPane } from './views/PreviewPane.js';
import { TreeView } from './views/TreeView.js';

// ── State ─────────────────────────────────────────────────────────────────────

interface State {
  buckets: BucketSummary[];
  files: FileSummary[];
  quota: QuotaSummary | null;
  selectedBucketId: string | null;
  currentFolderPath: string;
  viewMode: ViewMode;
  selectedFileIds: Set<string>;
  previewFileId: string | null;
  searchQuery: string;
  loading: boolean;
  dialog:
    | { type: 'upload' }
    | { type: 'create-folder' }
    | { type: 'rename'; fileId: string; currentName: string }
    | { type: 'move'; fileIds: string[] }
    | { type: 'sharing'; fileId: string; filename: string }
    | { type: 'properties'; fileId: string }
    | null;
}

type Action =
  | { type: 'SET_BUCKETS'; buckets: BucketSummary[] }
  | { type: 'SET_FILES'; files: FileSummary[] }
  | { type: 'SET_QUOTA'; quota: QuotaSummary }
  | { type: 'SELECT_BUCKET'; bucketId: string }
  | { type: 'SELECT_FOLDER'; path: string }
  | { type: 'SET_VIEW_MODE'; mode: ViewMode }
  | { type: 'SELECT_FILE'; fileId: string; multi: boolean }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_PREVIEW'; fileId: string | null }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'OPEN_DIALOG'; dialog: State['dialog'] }
  | { type: 'CLOSE_DIALOG' }
  | { type: 'FILE_CREATED'; file: FileSummary }
  | { type: 'FILE_DELETED'; fileId: string }
  | { type: 'FILE_UPDATED'; file: FileSummary };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_BUCKETS':
      return { ...state, buckets: action.buckets };
    case 'SET_FILES':
      return { ...state, files: action.files, loading: false };
    case 'SET_QUOTA':
      return { ...state, quota: action.quota };
    case 'SELECT_BUCKET':
      return {
        ...state,
        selectedBucketId: action.bucketId,
        currentFolderPath: '',
        selectedFileIds: new Set(),
        previewFileId: null,
        files: [],
        loading: true,
      };
    case 'SELECT_FOLDER':
      return {
        ...state,
        currentFolderPath: action.path,
        selectedFileIds: new Set(),
        previewFileId: null,
        files: [],
        loading: true,
      };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode };
    case 'SELECT_FILE': {
      if (action.multi) {
        const next = new Set(state.selectedFileIds);
        if (next.has(action.fileId)) next.delete(action.fileId);
        else next.add(action.fileId);
        return { ...state, selectedFileIds: next };
      }
      return {
        ...state,
        selectedFileIds: new Set([action.fileId]),
        previewFileId: action.fileId,
      };
    }
    case 'CLEAR_SELECTION':
      return { ...state, selectedFileIds: new Set(), previewFileId: null };
    case 'SET_PREVIEW':
      return { ...state, previewFileId: action.fileId };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query, loading: true };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'OPEN_DIALOG':
      return { ...state, dialog: action.dialog };
    case 'CLOSE_DIALOG':
      return { ...state, dialog: null };
    case 'FILE_CREATED':
      return {
        ...state,
        files:
          action.file.bucketId === state.selectedBucketId &&
          action.file.folderPath === state.currentFolderPath
            ? [action.file, ...state.files]
            : state.files,
      };
    case 'FILE_DELETED':
      return { ...state, files: state.files.filter((f) => f.id !== action.fileId) };
    case 'FILE_UPDATED':
      return {
        ...state,
        files: state.files.map((f) => (f.id === action.file.id ? action.file : f)),
      };
    default:
      return state;
  }
}

const initial: State = {
  buckets: [],
  files: [],
  quota: null,
  selectedBucketId: null,
  currentFolderPath: '',
  viewMode: 'grid',
  selectedFileIds: new Set(),
  previewFileId: null,
  searchQuery: '',
  loading: false,
  dialog: null,
};

// ── Props / API surface ───────────────────────────────────────────────────────

export interface StorageBrowserApi {
  workspaceId: string;
  fetchBuckets: () => Promise<BucketSummary[]>;
  fetchFiles: (bucketId: string, folderPath: string, search?: string) => Promise<FileSummary[]>;
  fetchQuota: () => Promise<QuotaSummary>;
  uploadFiles: (bucketId: string, folderPath: string, files: File[]) => Promise<void>;
  createBucket: (name: string, slug: string) => Promise<BucketSummary>;
  createFolder: (bucketId: string, path: string) => Promise<void>;
  renameFile: (fileId: string, newName: string) => Promise<void>;
  moveFiles: (fileIds: string[], bucketId: string, folderPath: string) => Promise<void>;
  deleteFiles: (fileIds: string[]) => Promise<void>;
  createSignedUrl: (fileId: string, ttlHours: number, limit?: number) => Promise<string>;
  revokeSignedUrl: (urlId: string) => Promise<void>;
  saveTags: (fileId: string, tags: string[]) => Promise<void>;
  saveMetadata: (fileId: string, metadata: Record<string, string>) => Promise<void>;
  getPreviewUrl: (fileId: string) => Promise<string | undefined>;
}

interface StorageBrowserProps {
  api: StorageBrowserApi;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StorageBrowser({ api }: StorageBrowserProps) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();

  // Load buckets on mount
  useEffect(() => {
    const load = async () => {
      const [buckets, quota] = await Promise.all([api.fetchBuckets(), api.fetchQuota()]);
      dispatch({ type: 'SET_BUCKETS', buckets });
      dispatch({ type: 'SET_QUOTA', quota });
    };
    void load();
  }, [api]);

  // Load files when bucket/folder/search changes
  useEffect(() => {
    if (!state.selectedBucketId) return;
    const bucketId = state.selectedBucketId;
    let cancelled = false;
    const load = async () => {
      const files = await api.fetchFiles(
        bucketId,
        state.currentFolderPath,
        state.searchQuery || undefined,
      );
      if (!cancelled) dispatch({ type: 'SET_FILES', files });
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [api, state.selectedBucketId, state.currentFolderPath, state.searchQuery]);

  // Load preview URL when preview file changes
  useEffect(() => {
    if (!state.previewFileId) {
      setPreviewUrl(undefined);
      return;
    }
    const fileId = state.previewFileId;
    let cancelled = false;
    const load = async () => {
      const url = await api.getPreviewUrl(fileId);
      if (!cancelled) setPreviewUrl(url);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [api, state.previewFileId]);

  // Realtime handler
  const handleStorageEvent = useCallback(
    (event: StorageEvent) => {
      if (event.type === 'file.deleted' && event.fileId) {
        dispatch({ type: 'FILE_DELETED', fileId: event.fileId });
      } else if (event.type === 'file.created' && event.payload) {
        const bucketId = state.selectedBucketId;
        if (bucketId) {
          void api.fetchFiles(bucketId, state.currentFolderPath).then((files) => {
            dispatch({ type: 'SET_FILES', files });
            return undefined;
          });
        }
      }
    },
    [api, state.selectedBucketId, state.currentFolderPath],
  );

  // Compute folders from current files
  const folders = Array.from(new Set(state.files.map((f) => f.folderPath).filter(Boolean)));

  const previewFile = state.previewFileId
    ? (state.files.find((f) => f.id === state.previewFileId) ?? null)
    : null;

  const handleDelete = async (fileId: string) => {
    await api.deleteFiles([fileId]);
    dispatch({ type: 'FILE_DELETED', fileId });
    dispatch({ type: 'CLOSE_DIALOG' });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(state.selectedFileIds);
    await api.deleteFiles(ids);
    for (const id of ids) dispatch({ type: 'FILE_DELETED', fileId: id });
  };

  const handleCreateBucket = async () => {
    const name = window.prompt('Bucket name?');
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const bucket = await api.createBucket(name, slug);
    dispatch({ type: 'SET_BUCKETS', buckets: [...state.buckets, bucket] });
  };

  const handleDownload = (id: string) => {
    void api.getPreviewUrl(id).then((u) => {
      if (u) window.open(u);
      return undefined;
    });
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <StorageEventListener workspaceId={api.workspaceId} onEvent={handleStorageEvent} />

      {/* Toolbar */}
      <header className="flex items-center gap-3 border-b bg-card px-4 py-2">
        <h1 className="text-base font-semibold">Storage</h1>

        {/* Breadcrumb */}
        {state.selectedBucketId && (
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1 text-sm text-muted-foreground"
          >
            <span>/</span>
            <span className="font-medium text-foreground">
              {state.buckets.find((b) => b.id === state.selectedBucketId)?.name}
            </span>
            {state.currentFolderPath && (
              <>
                <span>/</span>
                <span>{state.currentFolderPath}</span>
              </>
            )}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          <SearchPanel
            value={state.searchQuery}
            onChange={(q) => {
              dispatch({ type: 'SET_SEARCH', query: q });
            }}
          />

          {/* View mode toggle */}
          <div className="flex rounded-md border border-border" role="group" aria-label="View mode">
            <button
              aria-pressed={state.viewMode === 'grid'}
              onClick={() => {
                dispatch({ type: 'SET_VIEW_MODE', mode: 'grid' });
              }}
              className={`rounded-l-md px-2 py-1.5 text-sm transition-colors ${state.viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              title="Grid view"
            >
              ⊞
            </button>
            <button
              aria-pressed={state.viewMode === 'list'}
              onClick={() => {
                dispatch({ type: 'SET_VIEW_MODE', mode: 'list' });
              }}
              className={`rounded-r-md px-2 py-1.5 text-sm transition-colors ${state.viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              title="List view"
            >
              ☰
            </button>
          </div>

          {state.selectedBucketId && (
            <>
              <button
                onClick={() => {
                  dispatch({ type: 'OPEN_DIALOG', dialog: { type: 'create-folder' } });
                }}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                New folder
              </button>
              <button
                onClick={() => {
                  dispatch({ type: 'OPEN_DIALOG', dialog: { type: 'upload' } });
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Upload
              </button>
            </>
          )}

          {/* Bulk actions */}
          {state.selectedFileIds.size > 1 && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1">
              <span className="text-xs text-muted-foreground">
                {state.selectedFileIds.size} selected
              </span>
              <button
                onClick={() => {
                  dispatch({
                    type: 'OPEN_DIALOG',
                    dialog: { type: 'move', fileIds: Array.from(state.selectedFileIds) },
                  });
                }}
                className="text-xs hover:text-foreground text-muted-foreground"
              >
                Move
              </button>
              <button
                onClick={() => {
                  void handleBulkDelete();
                }}
                className="text-xs text-destructive hover:text-destructive/80"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <QuotaPanel quota={state.quota} />
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <TreeView
          buckets={state.buckets}
          selectedBucketId={state.selectedBucketId}
          currentFolderPath={state.currentFolderPath}
          folders={folders}
          onSelectBucket={(id) => {
            dispatch({ type: 'SELECT_BUCKET', bucketId: id });
          }}
          onSelectFolder={(path) => {
            dispatch({ type: 'SELECT_FOLDER', path });
          }}
          onCreateBucket={() => {
            void handleCreateBucket();
          }}
        />

        <main
          className="flex flex-1 flex-col overflow-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) dispatch({ type: 'CLEAR_SELECTION' });
          }}
        >
          {state.loading && (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <div
                className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
                role="status"
                aria-label="Loading"
              />
            </div>
          )}

          {!state.loading && !state.selectedBucketId && (
            <div className="flex flex-1 items-center justify-center text-center text-muted-foreground">
              <div>
                <p className="text-base font-medium">Select a bucket to browse files</p>
                <p className="text-sm">or create a new bucket using the sidebar</p>
              </div>
            </div>
          )}

          {!state.loading && state.selectedBucketId && state.viewMode === 'grid' && (
            <GridView
              files={state.files}
              selectedFileIds={state.selectedFileIds}
              onSelectFile={(id, multi) => {
                dispatch({ type: 'SELECT_FILE', fileId: id, multi });
              }}
              onOpenPreview={(id) => {
                dispatch({ type: 'SET_PREVIEW', fileId: id });
              }}
              onContextMenu={(fileId) => {
                dispatch({
                  type: 'OPEN_DIALOG',
                  dialog: {
                    type: 'rename',
                    fileId,
                    currentName: state.files.find((f) => f.id === fileId)?.filename ?? '',
                  },
                });
              }}
            />
          )}

          {!state.loading && state.selectedBucketId && state.viewMode === 'list' && (
            <ListView
              files={state.files}
              selectedFileIds={state.selectedFileIds}
              onSelectFile={(id, multi) => {
                dispatch({ type: 'SELECT_FILE', fileId: id, multi });
              }}
              onOpenPreview={(id) => {
                dispatch({ type: 'SET_PREVIEW', fileId: id });
              }}
              onContextMenu={(fileId) => {
                dispatch({
                  type: 'OPEN_DIALOG',
                  dialog: {
                    type: 'rename',
                    fileId,
                    currentName: state.files.find((f) => f.id === fileId)?.filename ?? '',
                  },
                });
              }}
            />
          )}
        </main>

        {previewFile && (
          <PreviewPane
            file={previewFile}
            {...(previewUrl !== undefined ? { previewUrl } : {})}
            onClose={() => {
              dispatch({ type: 'SET_PREVIEW', fileId: null });
            }}
            onDownload={handleDownload}
            onShare={(id) => {
              dispatch({
                type: 'OPEN_DIALOG',
                dialog: { type: 'sharing', fileId: id, filename: previewFile.filename },
              });
            }}
            onProperties={(id) => {
              dispatch({ type: 'OPEN_DIALOG', dialog: { type: 'properties', fileId: id } });
            }}
            onDelete={(id) => {
              void handleDelete(id);
            }}
          />
        )}
      </div>

      {/* Dialogs */}
      {state.dialog?.type === 'upload' &&
        state.selectedBucketId &&
        (() => {
          const bucketId = state.selectedBucketId;
          return (
            <UploadDialog
              bucketId={bucketId}
              folderPath={state.currentFolderPath}
              onUpload={(files) => api.uploadFiles(bucketId, state.currentFolderPath, files)}
              onClose={() => {
                dispatch({ type: 'CLOSE_DIALOG' });
              }}
            />
          );
        })()}

      {state.dialog?.type === 'create-folder' &&
        state.selectedBucketId &&
        (() => {
          const bucketId = state.selectedBucketId;
          return (
            <CreateFolderDialog
              currentPath={state.currentFolderPath}
              onConfirm={(path) => api.createFolder(bucketId, path)}
              onClose={() => {
                dispatch({ type: 'CLOSE_DIALOG' });
              }}
            />
          );
        })()}

      {state.dialog?.type === 'rename' &&
        (() => {
          const d = state.dialog as { type: 'rename'; fileId: string; currentName: string };
          return (
            <RenameDialog
              currentName={d.currentName}
              onConfirm={(newName) => api.renameFile(d.fileId, newName)}
              onClose={() => {
                dispatch({ type: 'CLOSE_DIALOG' });
              }}
            />
          );
        })()}

      {state.dialog?.type === 'move' &&
        state.selectedBucketId &&
        (() => {
          const d = state.dialog as { type: 'move'; fileIds: string[] };
          const currentBucketId = state.selectedBucketId;
          return (
            <MoveDialog
              fileCount={d.fileIds.length}
              buckets={state.buckets}
              currentBucketId={currentBucketId}
              currentFolderPath={state.currentFolderPath}
              onConfirm={(bucketId, folderPath) => api.moveFiles(d.fileIds, bucketId, folderPath)}
              onClose={() => {
                dispatch({ type: 'CLOSE_DIALOG' });
              }}
            />
          );
        })()}

      {state.dialog?.type === 'sharing' &&
        (() => {
          const d = state.dialog as { type: 'sharing'; fileId: string; filename: string };
          return (
            <SharingDialog
              fileId={d.fileId}
              filename={d.filename}
              onCreateSignedUrl={api.createSignedUrl}
              onRevokeSignedUrl={api.revokeSignedUrl}
              signedUrls={[]}
              onClose={() => {
                dispatch({ type: 'CLOSE_DIALOG' });
              }}
            />
          );
        })()}

      {state.dialog?.type === 'properties' &&
        (() => {
          const d = state.dialog as { type: 'properties'; fileId: string };
          const file = state.files.find((f) => f.id === d.fileId);
          if (!file) return null;
          return (
            <PropertiesDialog
              file={file}
              onSaveTags={api.saveTags}
              onSaveMetadata={api.saveMetadata}
              onClose={() => {
                dispatch({ type: 'CLOSE_DIALOG' });
              }}
            />
          );
        })()}
    </div>
  );
}
