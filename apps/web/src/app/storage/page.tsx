import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Static mock data (matches prototype)
// ---------------------------------------------------------------------------

interface Bucket {
  id: string;
  name: string;
  access: 'Public' | 'Private';
  fileCount: number;
  size: string;
}

const BUCKETS: Bucket[] = [
  { id: 'b1', name: 'contacts-uploads', access: 'Public', fileCount: 147, size: '624 MB' },
  { id: 'b2', name: 'deals-attachments', access: 'Private', fileCount: 82, size: '412 MB' },
  { id: 'b3', name: 'user-avatars', access: 'Public', fileCount: 18, size: '184 MB' },
];

interface StorageFile {
  name: string;
  size: string;
  icon: string;
}

const FILES: StorageFile[] = [
  { name: 'contract-acme.pdf', size: '120 KB', icon: '📄' },
  { name: 'logo-final.png', size: '847 KB', icon: '🖼' },
  { name: 'proposal-q3.docx', size: '42 KB', icon: '📋' },
  { name: 'metrics.xlsx', size: '219 KB', icon: '📊' },
  { name: 'demo-recording.mp4', size: '12.3 MB', icon: '🎬' },
  { name: 'invoice-1247.pdf', size: '180 KB', icon: '📑' },
  { name: 'archive.zip', size: '2.4 MB', icon: '📦' },
  { name: 'export.csv', size: '89 KB', icon: '📤' },
  { name: 'agreement.pdf', size: '150 KB', icon: '📁' },
  { name: 'header-banner.png', size: '220 KB', icon: '📎' },
  { name: 'rates.xlsx', size: '330 KB', icon: '💼' },
  { name: 'redacted.pdf', size: '540 KB', icon: '📃' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StoragePage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Storage</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>3 buckets · 247 files · 1.2 GB / 5 GB</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            + New bucket
          </Button>
          <Button size="sm" type="button">
            Upload
          </Button>
        </div>
      </div>

      {/* Bucket cards */}
      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 24 }}>
        {BUCKETS.map((bucket) => (
          <div
            key={bucket.id}
            className="rounded-md border bg-card text-card-foreground p-4"
            style={{ cursor: 'pointer' }}
          >
            <div className="mb-3 flex items-center justify-between border-b pb-3">
              <div className="text-sm font-semibold font-mono text-sm">{bucket.name}</div>
              <span
                className={
                  bucket.access === 'Private'
                    ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground'
                }
              >
                {bucket.access}
              </span>
            </div>
            <div style={{ fontSize: 12 }}>
              {bucket.fileCount} files · {bucket.size}
            </div>
          </div>
        ))}
      </div>

      {/* File grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {FILES.map((file) => (
          <div
            key={file.name}
            className="rounded-md border bg-card text-card-foreground p-4"
            style={{ padding: 12, cursor: 'pointer' }}
          >
            <div
              style={{
                aspectRatio: '1',
                borderRadius: 4,
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
              }}
            >
              {file.icon}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={file.name}
            >
              {file.name}
            </div>
            <div className="tabular-nums" style={{ fontSize: 11, marginTop: 2 }}>
              {file.size}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
