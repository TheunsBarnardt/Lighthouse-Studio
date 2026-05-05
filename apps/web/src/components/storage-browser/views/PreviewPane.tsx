'use client';

import type { FileSummary } from '../types.js';

import { formatBytes } from '../types.js';

interface PreviewPaneProps {
  file: FileSummary | null;
  previewUrl?: string; // signed URL for the file content
  onClose: () => void;
  onDownload: (fileId: string) => void;
  onShare: (fileId: string) => void;
  onProperties: (fileId: string) => void;
  onDelete: (fileId: string) => void;
}

export function PreviewPane({
  file,
  previewUrl,
  onClose,
  onDownload,
  onShare,
  onProperties,
  onDelete,
}: PreviewPaneProps) {
  if (!file) return null;

  const isImage = file.contentType?.startsWith('image/');
  const isPdf = file.contentType === 'application/pdf';
  const isVideo = file.contentType?.startsWith('video/');
  const isMarkdown = file.contentType === 'text/markdown' || file.filename.endsWith('.md');
  const isText = file.contentType?.startsWith('text/') || isMarkdown;

  return (
    <aside className="flex h-full w-80 flex-col border-l bg-card" aria-label="File preview">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="truncate text-sm font-medium" title={file.filename}>
          {file.filename}
        </h2>
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Preview area */}
      <div className="flex flex-1 items-center justify-center overflow-auto bg-muted/20 p-4">
        {previewUrl && isImage && (
          <img
            src={previewUrl}
            alt={file.filename}
            className="max-h-full max-w-full rounded object-contain shadow"
          />
        )}
        {previewUrl && isPdf && (
          <embed
            src={previewUrl}
            type="application/pdf"
            className="h-full w-full rounded"
            title={file.filename}
          />
        )}
        {previewUrl && isVideo && (
          <video src={previewUrl} controls className="max-h-full max-w-full rounded shadow">
            Your browser does not support the video tag.
          </video>
        )}
        {previewUrl && isText && !isPdf && !isVideo && (
          <iframe
            src={previewUrl}
            title={file.filename}
            className="h-full w-full rounded border bg-background"
            sandbox="allow-same-origin"
          />
        )}
        {!previewUrl && (
          <div className="text-center text-muted-foreground">
            <div className="mb-2 text-5xl">
              {isImage ? '🖼️' : isPdf ? '📕' : isVideo ? '🎬' : '📄'}
            </div>
            <p className="text-sm">No preview available</p>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="border-t p-4 text-xs text-muted-foreground space-y-1">
        <div className="flex justify-between">
          <span>Size</span>
          <span className="font-medium text-foreground">{formatBytes(file.sizeBytes)}</span>
        </div>
        {file.contentType && (
          <div className="flex justify-between">
            <span>Type</span>
            <span className="truncate font-medium text-foreground max-w-[60%]">
              {file.contentType}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Modified</span>
          <span className="font-medium text-foreground">
            {new Date(file.updatedAt).toLocaleDateString()}
          </span>
        </div>
        {file.piiFlag && (
          <div className="rounded bg-destructive/10 px-2 py-1 text-center text-destructive font-medium">
            PII — Personal Data
          </div>
        )}
        {file.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {file.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t p-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            onDownload(file.id);
          }}
          className="flex items-center justify-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Download
        </button>
        <button
          onClick={() => {
            onShare(file.id);
          }}
          className="flex items-center justify-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Share
        </button>
        <button
          onClick={() => {
            onProperties(file.id);
          }}
          className="flex items-center justify-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Properties
        </button>
        <button
          onClick={() => {
            onDelete(file.id);
          }}
          className="flex items-center justify-center gap-1.5 rounded border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
        >
          Delete
        </button>
      </div>
    </aside>
  );
}
