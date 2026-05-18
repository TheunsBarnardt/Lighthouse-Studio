'use client';

import { ChevronUp, Eye, Globe, Search, Sparkles, Star, Wrench, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  MODELS,
  PROVIDER_LABEL,
  PROVIDER_MARK,
  type ModelCapability,
  type ModelEntry,
  type ModelProvider,
} from '@/lib/ai/model-registry';

interface ModelPickerProps {
  selectedId: string;
  onSelect: (id: string) => void;
  starredIds?: Set<string>;
  onToggleStar?: (id: string) => void;
  onUpgradeClick?: () => void;
}

/**
 * t3.chat-style model picker.
 *
 * Trigger: pill button showing the current model name + tier.
 * Popover: search box, provider rail (vertical column of one-letter chips on
 * the left), model list (right) with capability icons, star toggle, legacy
 * expander, and a "Unlock all models" upgrade banner.
 */
export function ModelPicker({
  selectedId,
  onSelect,
  starredIds,
  onToggleStar,
  onUpgradeClick,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<ModelProvider | 'all'>('all');
  const [showLegacy, setShowLegacy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => MODELS.find((m) => m.id === selectedId) ?? MODELS[0],
    [selectedId],
  );

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const providersWithModels = useMemo(() => {
    const set = new Set<ModelProvider>();
    for (const m of MODELS) set.add(m.provider);
    return [...set];
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MODELS.filter((m) => {
      if (providerFilter !== 'all' && m.provider !== providerFilter) return false;
      if (!showLegacy && m.legacy) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.tagline.toLowerCase().includes(q) ||
        PROVIDER_LABEL[m.provider].toLowerCase().includes(q)
      );
    });
  }, [query, providerFilter, showLegacy]);

  const legacyHiddenCount = useMemo(() => MODELS.filter((m) => m.legacy).length, []);

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        title="Choose model"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px 4px 10px',
          borderRadius: 999,
          border: '1px solid var(--border)',
          background: 'var(--card)',
          color: 'var(--foreground)',
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
          minHeight: 28,
        }}
      >
        <span style={{ fontWeight: 500 }}>{selected.name}</span>
        <TierBadge tier={selected.tier} />
        <ChevronUp
          style={{
            width: 14,
            height: 14,
            opacity: 0.7,
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform 120ms',
          }}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Model picker"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            width: 520,
            maxWidth: 'calc(100vw - 32px)',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
            zIndex: 60,
            overflow: 'hidden',
          }}
        >
          {/* Upgrade banner */}
          {onUpgradeClick && (
            <div
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--border)',
                background:
                  'linear-gradient(90deg, color-mix(in srgb, var(--primary) 18%, transparent), transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Unlock all models</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                  <span style={{ color: 'oklch(0.70 0.22 320)' }}>$8</span>
                  <span>/month</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onUpgradeClick}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'oklch(0.62 0.20 320)',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Upgrade
              </button>
            </div>
          )}

          {/* Search */}
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Search style={{ width: 14, height: 14, opacity: 0.6 }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="Search models…"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--foreground)',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Body: provider rail + model list */}
          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', maxHeight: 360 }}>
            <div
              style={{
                borderRight: '1px solid var(--border)',
                padding: '8px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                alignItems: 'center',
                overflowY: 'auto',
              }}
            >
              <ProviderChip
                mark="★"
                label="All models"
                active={providerFilter === 'all'}
                onClick={() => {
                  setProviderFilter('all');
                }}
              />
              {providersWithModels.map((p) => (
                <ProviderChip
                  key={p}
                  mark={PROVIDER_MARK[p]}
                  label={PROVIDER_LABEL[p]}
                  active={providerFilter === p}
                  onClick={() => {
                    setProviderFilter(p);
                  }}
                />
              ))}
            </div>

            <div style={{ overflowY: 'auto', padding: '4px 0' }}>
              {visible.length === 0 && (
                <div
                  style={{
                    padding: 24,
                    fontSize: 12,
                    textAlign: 'center',
                    color: 'var(--muted-foreground)',
                  }}
                >
                  No models match.
                </div>
              )}
              {visible.map((m) => (
                <ModelRow
                  key={m.id}
                  model={m}
                  selected={m.id === selectedId}
                  starred={starredIds?.has(m.id) ?? Boolean(m.starred)}
                  onClick={() => {
                    onSelect(m.id);
                    setOpen(false);
                  }}
                  {...(onToggleStar !== undefined && {
                    onToggleStar: () => {
                      onToggleStar(m.id);
                    },
                  })}
                />
              ))}

              {legacyHiddenCount > 0 && !showLegacy && providerFilter === 'all' && !query && (
                <button
                  type="button"
                  onClick={() => {
                    setShowLegacy(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'transparent',
                    border: 'none',
                    borderTop: '1px solid var(--border)',
                    color: 'var(--muted-foreground)',
                    fontSize: 12,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles style={{ width: 13, height: 13 }} />
                    {legacyHiddenCount} legacy models
                  </span>
                  <span style={{ marginLeft: 'auto', opacity: 0.7 }}>▾</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderChip({
  mark,
  label,
  active,
  onClick,
}: {
  mark: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      style={{
        width: 32,
        height: 32,
        borderRadius: 6,
        border: 'none',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--muted-foreground)',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'inherit',
      }}
    >
      {mark}
    </button>
  );
}

function ModelRow({
  model,
  selected,
  starred,
  onClick,
  onToggleStar,
}: {
  model: ModelEntry;
  selected: boolean;
  starred: boolean;
  onClick: () => void;
  onToggleStar?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 14px',
        cursor: 'pointer',
        background: selected ? 'var(--accent)' : 'transparent',
        borderLeft: selected ? '2px solid var(--primary)' : '2px solid transparent',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontWeight: 500,
              fontSize: 13,
              color: selected ? 'var(--primary)' : 'var(--foreground)',
            }}
          >
            {model.name}
          </span>
          <TierBadge tier={model.tier} />
          {onToggleStar && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar();
              }}
              title={starred ? 'Unstar' : 'Star'}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 2,
                cursor: 'pointer',
                color: starred ? 'oklch(0.78 0.16 85)' : 'var(--muted-foreground)',
                opacity: starred ? 1 : 0.55,
              }}
            >
              <Star style={{ width: 13, height: 13, fill: starred ? 'currentColor' : 'none' }} />
            </button>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
          {model.tagline}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingTop: 2 }}>
        {model.capabilities.map((c) => (
          <CapabilityIcon key={c} cap={c} />
        ))}
      </div>
    </div>
  );
}

function CapabilityIcon({ cap }: { cap: ModelCapability }) {
  const common = { width: 13, height: 13 } as const;
  const wrapStyle: React.CSSProperties = {
    width: 22,
    height: 22,
    borderRadius: 4,
    background: 'color-mix(in srgb, var(--foreground) 8%, transparent)',
    color: 'var(--muted-foreground)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  const labels: Record<ModelCapability, string> = {
    vision: 'Vision',
    web: 'Web search',
    reasoning: 'Reasoning',
    tools: 'Tool use',
  };
  return (
    <span title={labels[cap]} style={wrapStyle}>
      {cap === 'vision' && <Eye {...common} />}
      {cap === 'web' && <Globe {...common} />}
      {cap === 'reasoning' && <Zap {...common} />}
      {cap === 'tools' && <Wrench {...common} />}
    </span>
  );
}

function TierBadge({ tier }: { tier: '$' | '$$' | '$$$' | '$$$+' }) {
  const palette: Record<string, string> = {
    $: 'oklch(0.62 0.16 145)',
    $$: 'oklch(0.62 0.16 145)',
    $$$: 'oklch(0.62 0.16 145)',
    '$$$+': 'oklch(0.62 0.20 25)',
  };
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: palette[tier],
        letterSpacing: '0.02em',
      }}
    >
      {tier}
    </span>
  );
}
