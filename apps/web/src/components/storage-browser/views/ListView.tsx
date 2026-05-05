'use client';

import type { FileSummary } from '../types.js';

import { fileIcon, formatBytes } from '../types.js';

interface ListViewProps {
  files: FileSummary[];
  selectedFileIds: Set<string>;
  onSelectFile: (fileId: string, multi: boolean) => void;
  onOpenPreview: (fileId: string) => void;
  onContextMenu: (fileId: string, x: number, y: number) => void;
}

export function ListView({
  files,
  selectedFileIds,
  onSelectFile,
  onOpenPreview,
  onContextMenu,
}: ListViewProps) {
  if (files.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">No files in this location.</p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm" role="grid">
      <thead>
        <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
          <th className="w-8 px-3 py-2 text-left">
            <span className="sr-only">Select</span>
          </th>
          <th className="px-3 py-2 text-left font-medium">Name</th>
          <th className="px-3 py-2 text-right font-medium">Size</th>
          <th className="px-3 py-2 text-left font-medium">Type</th>
          <th className="px-3 py-2 text-left font-medium">Modified</th>
          <th className="px-3 py-2 text-left font-medium">Tags</th>
        </tr>
      </thead>
      <tbody>
        {files.map((file) => {
          const isSelected = selectedFileIds.has(file.id);
          return (
            <tr
              key={file.id}
              role="row"
              aria-selected={isSelected}
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
              className={`cursor-pointer border-b transition-colors ${
                isSelected ? 'bg-primary/5' : 'hover:bg-muted/40'
              }`}
            >
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {
                    onSelectFile(file.id, true);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  aria-label={`Select ${file.filename}`}
                  className="rounded border-border"
                />
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-base">
                    {fileIcon(file.contentType)}
                  </span>
                  <span className="max-w-xs truncate font-medium">{file.filename}</span>
                  {file.piiFlag && (
                    <span className="rounded bg-destructive/10 px-1 py-0.5 text-[10px] font-medium text-destructive">
                      PII
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {formatBytes(file.sizeBytes)}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{file.contentType ?? '—'}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {new Date(file.updatedAt).toLocaleDateString()}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {file.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                  {file.tags.length > 3 && (
                    <span className="text-xs text-muted-foreground">+{file.tags.length - 3}</span>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
