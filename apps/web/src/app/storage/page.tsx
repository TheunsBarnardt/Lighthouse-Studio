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
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Storage
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            3 buckets · 247 files · 1.2 GB / 5 GB
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-secondary pg-btn-sm">+ New bucket</button>
          <button className="pg-btn pg-btn-primary pg-btn-sm">Upload</button>
        </div>
      </div>

      {/* Bucket cards */}
      <div className="pg-grid pg-grid-3" style={{ marginBottom: 24 }}>
        {BUCKETS.map((bucket) => (
          <div key={bucket.id} className="pg-card" style={{ cursor: 'pointer' }}>
            <div className="pg-card-header">
              <div className="pg-card-title pg-mono">{bucket.name}</div>
              <span
                className={
                  bucket.access === 'Private'
                    ? 'pg-badge pg-badge-success'
                    : 'pg-badge pg-badge-default'
                }
              >
                {bucket.access}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
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
          <div key={file.name} className="pg-card" style={{ padding: 12, cursor: 'pointer' }}>
            <div
              style={{
                aspectRatio: '1',
                background: 'var(--bg-canvas)',
                borderRadius: 4,
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--fg-tertiary)',
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
                color: 'var(--fg-primary)',
              }}
              title={file.name}
            >
              {file.name}
            </div>
            <div
              className="pg-tabular"
              style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 2 }}
            >
              {file.size}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
