'use client';

import type { FileSummary } from '../types.js';

import { fileIcon, formatBytes } from '../types.js';

interface GridViewProps {
  files: FileSummary[];
  selectedFileIds: Set<string>;
  onSelectFile: (fileId: string, multi: boolean) => void;
  onOpenPreview: (fileId: string) => void;
  onContextMenu: (fileId: string, x: number, y: number) => void;
}

export function GridView({
  files,
  selectedFileIds,
  onSelectFile,
  onOpenPreview,
  onContextMenu,
}: GridViewProps) {
  if (files.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center">
          <svg
            className="mx-auto mb-3 h-12 w-12 opacity-30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm">No files here. Upload something!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {files.map((file) => {
        const isSelected = selectedFileIds.has(file.id);
        const icon = fileIcon(file.contentType);

        return (
          <button
            key={file.id}
            onClick={(e) => {
              onSelectFile(file.id, e.ctrlKey || e.metaKey || e.shiftKey);
            }}
            onDoubleClick={() => {
              onOpenPreview(file.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenu(file.id, e.clientX, e.clientY);
            }}
            aria-selected={isSelected}
            className={`group flex flex-col items-center rounded-lg border p-3 text-center transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isSelected
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:bg-muted/50'
            }`}
          >
            {file.contentType?.startsWith('image/') ? (
              <div className="mb-2 flex h-16 w-full items-center justify-center rounded bg-muted text-3xl">
                {/* Thumbnail placeholder — real implementation loads from .thumbnails/ */}
                <span aria-hidden="true">🖼️</span>
              </div>
            ) : (
              <div className="mb-2 flex h-16 w-full items-center justify-center text-4xl">
                <span aria-hidden="true">{icon}</span>
              </div>
            )}

            <span
              className="line-clamp-2 w-full text-xs font-medium text-foreground"
              title={file.filename}
            >
              {file.filename}
            </span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              {formatBytes(file.sizeBytes)}
            </span>

            {file.piiFlag && (
              <span className="mt-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                PII
              </span>
            )}

            {isSelected && (
              <div className="absolute right-1.5 top-1.5 rounded-full bg-primary p-0.5 text-primary-foreground">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
