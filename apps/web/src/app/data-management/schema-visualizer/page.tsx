// ---------------------------------------------------------------------------
// Static SVG ER diagram
// ---------------------------------------------------------------------------
//
// Layout (600×400 viewBox):
//   contacts  — top-left   (x:20,  y:20,  w:130, h:110)
//   deals     — center     (x:220, y:140, w:150, h:130)
//   activities— right      (x:420, y:80,  w:150, h:130)
//   users     — top-right  (x:420, y:20,  w:130, h:80)
//
// FK lines (center-of-column approximations):
//   contacts.id → deals.contact_id
//   users.id    → deals.owner_id
//   deals.id    → activities.deal_id
//   contacts.id → activities.contact_id
// ---------------------------------------------------------------------------

function ErDiagram() {
  const tableBox = {
    rx: 4,
    stroke: 'var(--border-emphasis)',
    headerFill: 'var(--bg-surface-3)',
    bodyFill: 'var(--bg-surface)',
    textPrimary: 'var(--fg-primary)',
    accentText: 'var(--accent-primary)',
    fkLine: 'var(--accent-primary)',
  };

  return (
    <svg
      viewBox="0 0 600 400"
      style={{ width: '100%', height: 'auto', maxHeight: 420 }}
      aria-label="Entity-relationship diagram for public schema"
      role="img"
    >
      {/* ── contacts (x:20, y:20, w:140, h:114) ── */}
      <g aria-label="contacts table">
        <rect
          x="20"
          y="20"
          width="140"
          height="24"
          rx={tableBox.rx}
          ry={tableBox.rx}
          fill={tableBox.headerFill}
          stroke={tableBox.stroke}
          strokeWidth="1"
        />
        <rect x="20" y="32" width="140" height="12" fill={tableBox.headerFill} stroke="none" />
        <text
          x="90"
          y="36"
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill={tableBox.textPrimary}
        >
          contacts
        </text>
        <rect
          x="20"
          y="44"
          width="140"
          height="90"
          rx="0"
          ry="0"
          fill={tableBox.bodyFill}
          stroke={tableBox.stroke}
          strokeWidth="1"
        />
        <rect x="20" y="44" width="140" height="4" fill={tableBox.bodyFill} stroke="none" />
        {[
          { col: 'id', label: 'PK', y: 58 },
          { col: 'name', label: '', y: 76 },
          { col: 'email', label: '', y: 94 },
          { col: 'type', label: 'FK', y: 112 },
        ].map(({ col, label, y }) => (
          <g key={col}>
            <text x="32" y={y} fontSize="10" fontFamily="monospace" fill={tableBox.textPrimary}>
              {col}
            </text>
            {label && (
              <text
                x="148"
                y={y}
                textAnchor="end"
                fontSize="9"
                fontWeight="600"
                fill={label === 'PK' ? tableBox.accentText : tableBox.fkLine}
              >
                {label}
              </text>
            )}
          </g>
        ))}
      </g>

      {/* ── users (x:430, y:20, w:140, h:80) ── */}
      <g aria-label="users table">
        <rect
          x="430"
          y="20"
          width="140"
          height="24"
          rx={tableBox.rx}
          ry={tableBox.rx}
          fill={tableBox.headerFill}
          stroke={tableBox.stroke}
          strokeWidth="1"
        />
        <rect x="430" y="32" width="140" height="12" fill={tableBox.headerFill} stroke="none" />
        <text
          x="500"
          y="36"
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill={tableBox.textPrimary}
        >
          users
        </text>
        <rect
          x="430"
          y="44"
          width="140"
          height="60"
          rx="0"
          ry="0"
          fill={tableBox.bodyFill}
          stroke={tableBox.stroke}
          strokeWidth="1"
        />
        <rect x="430" y="44" width="140" height="4" fill={tableBox.bodyFill} stroke="none" />
        {[
          { col: 'id', label: 'PK', y: 58 },
          { col: 'email', label: '', y: 76 },
          { col: 'role', label: '', y: 94 },
        ].map(({ col, label, y }) => (
          <g key={col}>
            <text x="442" y={y} fontSize="10" fontFamily="monospace" fill={tableBox.textPrimary}>
              {col}
            </text>
            {label && (
              <text
                x="558"
                y={y}
                textAnchor="end"
                fontSize="9"
                fontWeight="600"
                fill={tableBox.accentText}
              >
                {label}
              </text>
            )}
          </g>
        ))}
      </g>

      {/* ── deals (x:210, y:140, w:160, h:130) ── */}
      <g aria-label="deals table">
        <rect
          x="210"
          y="140"
          width="160"
          height="24"
          rx={tableBox.rx}
          ry={tableBox.rx}
          fill={tableBox.headerFill}
          stroke={tableBox.stroke}
          strokeWidth="1"
        />
        <rect x="210" y="152" width="160" height="12" fill={tableBox.headerFill} stroke="none" />
        <text
          x="290"
          y="156"
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill={tableBox.textPrimary}
        >
          deals
        </text>
        <rect
          x="210"
          y="164"
          width="160"
          height="114"
          rx="0"
          ry="0"
          fill={tableBox.bodyFill}
          stroke={tableBox.stroke}
          strokeWidth="1"
        />
        <rect x="210" y="164" width="160" height="4" fill={tableBox.bodyFill} stroke="none" />
        {[
          { col: 'id', label: 'PK', y: 180 },
          { col: 'title', label: '', y: 198 },
          { col: 'stage', label: '', y: 216 },
          { col: 'amount', label: '', y: 234 },
          { col: 'contact_id', label: 'FK', y: 252 },
          { col: 'owner_id', label: 'FK', y: 270 },
        ].map(({ col, label, y }) => (
          <g key={col}>
            <text x="222" y={y} fontSize="10" fontFamily="monospace" fill={tableBox.textPrimary}>
              {col}
            </text>
            {label && (
              <text
                x="358"
                y={y}
                textAnchor="end"
                fontSize="9"
                fontWeight="600"
                fill={label === 'PK' ? tableBox.accentText : tableBox.fkLine}
              >
                {label}
              </text>
            )}
          </g>
        ))}
      </g>

      {/* ── activities (x:420, y:160, w:160, h:130) ── */}
      <g aria-label="activities table">
        <rect
          x="420"
          y="160"
          width="160"
          height="24"
          rx={tableBox.rx}
          ry={tableBox.rx}
          fill={tableBox.headerFill}
          stroke={tableBox.stroke}
          strokeWidth="1"
        />
        <rect x="420" y="172" width="160" height="12" fill={tableBox.headerFill} stroke="none" />
        <text
          x="500"
          y="176"
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill={tableBox.textPrimary}
        >
          activities
        </text>
        <rect
          x="420"
          y="184"
          width="160"
          height="114"
          rx="0"
          ry="0"
          fill={tableBox.bodyFill}
          stroke={tableBox.stroke}
          strokeWidth="1"
        />
        <rect x="420" y="184" width="160" height="4" fill={tableBox.bodyFill} stroke="none" />
        {[
          { col: 'id', label: 'PK', y: 200 },
          { col: 'deal_id', label: 'FK', y: 218 },
          { col: 'contact_id', label: 'FK', y: 236 },
          { col: 'kind', label: '', y: 254 },
          { col: 'notes', label: '', y: 272 },
          { col: 'created_at', label: '', y: 290 },
        ].map(({ col, label, y }) => (
          <g key={col}>
            <text x="432" y={y} fontSize="10" fontFamily="monospace" fill={tableBox.textPrimary}>
              {col}
            </text>
            {label && (
              <text
                x="568"
                y={y}
                textAnchor="end"
                fontSize="9"
                fontWeight="600"
                fill={label === 'PK' ? tableBox.accentText : tableBox.fkLine}
              >
                {label}
              </text>
            )}
          </g>
        ))}
      </g>

      {/* ── FK lines ── */}
      <line
        x1="160"
        y1="58"
        x2="210"
        y2="252"
        stroke={tableBox.fkLine}
        strokeWidth="1.5"
        strokeDasharray="4 3"
        strokeOpacity="0.7"
      />
      <line
        x1="430"
        y1="58"
        x2="370"
        y2="270"
        stroke={tableBox.fkLine}
        strokeWidth="1.5"
        strokeDasharray="4 3"
        strokeOpacity="0.7"
      />
      <line
        x1="370"
        y1="180"
        x2="420"
        y2="218"
        stroke={tableBox.fkLine}
        strokeWidth="1.5"
        strokeDasharray="4 3"
        strokeOpacity="0.7"
      />
      <line
        x1="160"
        y1="58"
        x2="420"
        y2="236"
        stroke={tableBox.fkLine}
        strokeWidth="1.5"
        strokeDasharray="4 3"
        strokeOpacity="0.5"
      />

      {(
        [
          [160, 58],
          [210, 252],
          [430, 58],
          [370, 270],
          [370, 180],
          [420, 218],
          [420, 236],
        ] as [number, number][]
      ).map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="3" fill={tableBox.fkLine} fillOpacity="0.7" />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SchemaVisualizerPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Schema Visualizer
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            22 tables · public schema · PostgreSQL 16
          </div>
        </div>
        <div className="pg-page-header-actions">
          <select
            style={{
              border: '1px solid var(--border-default)',
              borderRadius: 4,
              background: 'var(--bg-surface)',
              color: 'var(--fg-secondary)',
              fontSize: 12,
              padding: '3px 8px',
              height: 28,
            }}
          >
            <option>schema: public</option>
          </select>
          <button className="pg-btn pg-btn-secondary pg-btn-sm" type="button">
            Copy as SQL
          </button>
          <button className="pg-btn pg-btn-secondary pg-btn-sm" type="button">
            Export SVG
          </button>
          <button className="pg-btn pg-btn-secondary pg-btn-sm" type="button">
            Auto layout
          </button>
        </div>
      </div>

      <div
        style={{
          border: '1px solid var(--border-default)',
          borderRadius: 6,
          overflow: 'hidden',
          background: 'var(--bg-surface)',
          padding: 24,
          marginBottom: 12,
        }}
      >
        <ErDiagram />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 16,
          padding: '8px 0',
          fontSize: 11,
          color: 'var(--fg-tertiary)',
          justifyContent: 'center',
        }}
      >
        <span>
          <span style={{ color: 'oklch(0.65 0.16 75)' }}>●</span> Primary key
        </span>
        <span>
          <span style={{ color: 'var(--accent-primary)' }}>- - -</span> Foreign key
        </span>
        <span style={{ color: 'var(--fg-tertiary)' }}>○ Nullable</span>
      </div>
    </div>
  );
}
