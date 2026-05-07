'use client';

const BLOCK_OPTIONS: Record<string, { id: string; name: string; desc: string }[]> = {
  header: [
    { id: 'chrome-header-app', name: 'App Header', desc: 'Logo, nav, search, user menu' },
    { id: 'chrome-header-marketing', name: 'Marketing Header', desc: 'Logo, nav links, CTA button' },
    { id: 'chrome-header-minimal', name: 'Minimal Header', desc: 'Logo only' },
  ],
  sidenav: [
    { id: 'chrome-sidenav-vertical', name: 'Vertical Side Nav', desc: 'Collapsible groups with icons' },
    { id: 'chrome-sidenav-icon-only', name: 'Icon-Only Side Nav', desc: 'Compact, icons with tooltips' },
  ],
  breadcrumb: [
    { id: 'chrome-breadcrumb', name: 'Standard Breadcrumb', desc: 'Linear trail from route' },
    { id: 'chrome-breadcrumb-tabbed', name: 'Tabbed Breadcrumb', desc: 'With inline sub-section tabs' },
  ],
  footer: [
    { id: 'chrome-footer-standard', name: 'Standard Footer', desc: 'Multi-column with link groups' },
    { id: 'chrome-footer-minimal', name: 'Minimal Footer', desc: 'Single-line copyright + links' },
  ],
};

interface RegionPickerProps {
  label: string;
  region: string;
  selected?: { blockId: string; params: Record<string, unknown> };
  required?: boolean;
  onChange: (cfg: { blockId: string; params: Record<string, unknown> } | undefined) => void;
}

export function RegionPicker({ label, region, selected, required, onChange }: RegionPickerProps) {
  const options = BLOCK_OPTIONS[region] ?? [];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <label className="text-xs font-medium text-foreground">{label}</label>
        {!required && (
          <span className="text-xs text-muted-foreground">· optional</span>
        )}
      </div>
      <select
        value={selected?.blockId ?? ''}
        onChange={e => {
          const val = e.target.value;
          if (!val) {
            onChange(undefined);
          } else {
            onChange({ blockId: val, params: {} });
          }
        }}
        className="w-full text-xs border border-border rounded-md px-2.5 py-1.5 bg-background text-foreground"
      >
        {!required && <option value="">— none —</option>}
        {options.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.name}</option>
        ))}
      </select>
      {selected && (
        <p className="text-xs text-muted-foreground">
          {options.find(o => o.id === selected.blockId)?.desc}
        </p>
      )}
    </div>
  );
}
