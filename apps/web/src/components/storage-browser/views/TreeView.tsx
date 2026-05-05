'use client';

import type { BucketSummary } from '../types.js';

interface TreeViewProps {
  buckets: BucketSummary[];
  selectedBucketId: string | null;
  currentFolderPath: string;
  folders: string[]; // unique folder paths in the current bucket
  onSelectBucket: (bucketId: string) => void;
  onSelectFolder: (path: string) => void;
  onCreateBucket: () => void;
}

export function TreeView({
  buckets,
  selectedBucketId,
  currentFolderPath,
  folders,
  onSelectBucket,
  onSelectFolder,
  onCreateBucket,
}: TreeViewProps) {
  return (
    <aside className="flex h-full w-56 flex-col border-r bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Buckets
        </span>
        <button
          onClick={onCreateBucket}
          aria-label="Create bucket"
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {buckets.map((bucket) => (
          <div key={bucket.id}>
            <button
              onClick={() => {
                onSelectBucket(bucket.id);
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                selectedBucketId === bucket.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 7a2 2 0 012-2h12a2 2 0 012 2v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7zM4 13h16v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4z"
                />
              </svg>
              <span className="truncate">{bucket.name}</span>
            </button>

            {selectedBucketId === bucket.id && folders.length > 0 && (
              <div className="ml-6 border-l pl-2">
                <button
                  onClick={() => {
                    onSelectFolder('');
                  }}
                  className={`flex w-full items-center gap-1.5 px-2 py-1 text-xs transition-colors ${
                    currentFolderPath === ''
                      ? 'font-medium text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FolderIcon className="h-3.5 w-3.5" />/ (root)
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder}
                    onClick={() => {
                      onSelectFolder(folder);
                    }}
                    className={`flex w-full items-center gap-1.5 px-2 py-1 text-xs transition-colors ${
                      currentFolderPath === folder
                        ? 'font-medium text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <FolderIcon className="h-3.5 w-3.5" />
                    <span className="truncate">{folder}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {buckets.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground">No buckets yet.</p>
        )}
      </div>
    </aside>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
      />
    </svg>
  );
}
