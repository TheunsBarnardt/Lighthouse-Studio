'use client';

import type { CellProps } from '../types.js';

interface FileCellProps extends CellProps<string | null> {
  fileType: 'file' | 'image' | 'video';
  getPreviewUrl?: (fileId: string) => string;
}

export function FileCell({
  value,
  isEditing,
  canEdit,
  isRedacted,
  onStartEdit,
  onChange,
  onCommit,
  onCancel,
  columnDef,
  fileType,
  getPreviewUrl,
}: FileCellProps) {
  if (isRedacted) {
    return <span className="text-muted-foreground/40 select-none">••••••</span>;
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="file"
          className="text-xs"
          accept={fileType === 'image' ? 'image/*' : fileType === 'video' ? 'video/*' : undefined}
          autoFocus
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              // File upload is handled via storage API; here we surface the File
              // object to the parent through onChange with a special marker.
              // The Grid's commit handler uploads via StorageService, then sets the fileId.
              onChange(`__upload__:${file.name}` as unknown as string);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel();
          }}
        />
        {value && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-destructive"
            onClick={() => {
              onChange(null);
              void onCommit();
            }}
          >
            Clear
          </button>
        )}
      </div>
    );
  }

  if (!value) {
    return (
      <span
        className={`block text-sm text-muted-foreground/50 ${canEdit ? 'cursor-pointer hover:bg-muted/50' : ''}`}
        onClick={canEdit ? onStartEdit : undefined}
        onKeyDown={(e) => {
          if (canEdit && (e.key === 'Enter' || e.key === 'F2')) onStartEdit();
        }}
        tabIndex={canEdit ? 0 : -1}
        role={canEdit ? 'button' : undefined}
      >
        —
      </span>
    );
  }

  const previewUrl = getPreviewUrl?.(value);

  if (fileType === 'image' && previewUrl) {
    return (
      <button
        type="button"
        className="group relative h-8 w-8 overflow-hidden rounded border border-border"
        onClick={canEdit ? onStartEdit : undefined}
        aria-label={`${columnDef.name} image`}
      >
        <img
          src={previewUrl}
          alt={columnDef.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </button>
    );
  }

  return (
    <span
      className={`block truncate text-xs text-primary underline ${canEdit ? 'cursor-pointer' : ''}`}
      onClick={canEdit ? onStartEdit : undefined}
      onKeyDown={(e) => {
        if (canEdit && (e.key === 'Enter' || e.key === 'F2')) onStartEdit();
      }}
      tabIndex={canEdit ? 0 : -1}
      role={canEdit ? 'button' : undefined}
      title={value}
    >
      {value.slice(0, 20)}…
    </span>
  );
}
