// Shared types for the storage browser UI

export interface BucketSummary {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface FileSummary {
  id: string;
  bucketId: string;
  filename: string;
  folderPath: string;
  sizeBytes: number;
  contentType?: string;
  tags: string[];
  piiFlag: boolean;
  status: string;
  uploaderUserId?: string;
  createdAt: string;
  updatedAt: string;
  etag?: string;
}

export interface QuotaSummary {
  quotaBytes: number;
  usedBytes: number;
  usedPercent: number;
}

export type ViewMode = 'grid' | 'list';

export interface StorageBrowserState {
  selectedBucketId: string | null;
  currentFolderPath: string;
  viewMode: ViewMode;
  selectedFileIds: Set<string>;
  previewFileId: string | null;
  searchQuery: string;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${String(parseFloat((bytes / Math.pow(k, i)).toFixed(1)))} ${sizes[i] ?? ''}`;
}

export function fileIcon(contentType?: string): string {
  if (!contentType) return '📄';
  if (contentType.startsWith('image/')) return '🖼️';
  if (contentType.startsWith('video/')) return '🎬';
  if (contentType.startsWith('audio/')) return '🎵';
  if (contentType === 'application/pdf') return '📕';
  if (contentType.includes('word') || contentType.includes('document')) return '📝';
  if (contentType.includes('spreadsheet') || contentType.includes('excel')) return '📊';
  if (contentType.includes('zip') || contentType.includes('compressed')) return '📦';
  if (contentType.startsWith('text/')) return '📄';
  return '📁';
}
