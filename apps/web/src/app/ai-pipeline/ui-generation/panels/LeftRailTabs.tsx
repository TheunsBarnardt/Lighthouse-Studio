'use client';

import { Blocks, FileText, MessageSquare } from 'lucide-react';
import { useState, type ReactNode } from 'react';

type TabId = 'pages' | 'blocks' | 'chat';

interface LeftRailTabsProps {
  pages: ReactNode;
  blocks: ReactNode;
  chat: ReactNode;
  /** Pages tab badge content (e.g. component count). */
  pagesBadge?: string | number;
  /** Bumped to nudge the chat tab into focus when something new arrives. */
  chatAttention?: number;
}

const TABS: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: 'pages', label: 'Pages', icon: FileText },
  { id: 'blocks', label: 'Blocks', icon: Blocks },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
];

/**
 * Three-tab left rail for UI generation.
 *
 * Replaces the stacked Components + Blocks + Chat sections. Only one panel
 * is visible at a time so each gets the full rail height.
 */
export function LeftRailTabs({
  pages,
  blocks,
  chat,
  pagesBadge,
  chatAttention,
}: LeftRailTabsProps) {
  const [active, setActive] = useState<TabId>('pages');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div
        role="tablist"
        aria-label="UI generation panels"
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--card)',
          flexShrink: 0,
        }}
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          const showDot = t.id === 'chat' && chatAttention && chatAttention > 0 && !isActive;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActive(t.id);
              }}
              title={t.label}
              style={{
                flex: 1,
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '10px 4px',
                border: 'none',
                borderBottom: `2px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                background: 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: isActive ? 500 : 400,
                transition: 'color 120ms, border-color 120ms',
              }}
            >
              <Icon style={{ width: 14, height: 14 }} />
              <span>{t.label}</span>
              {t.id === 'pages' && pagesBadge !== undefined ? (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '0 5px',
                    borderRadius: 999,
                    background: isActive ? 'var(--accent)' : 'var(--muted)',
                    color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                    minWidth: 14,
                    textAlign: 'center',
                  }}
                >
                  {pagesBadge}
                </span>
              ) : null}
              {showDot ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 10,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            display: active === 'pages' ? 'flex' : 'none',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          {pages}
        </div>
        <div
          style={{
            display: active === 'blocks' ? 'flex' : 'none',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          {blocks}
        </div>
        <div
          style={{
            display: active === 'chat' ? 'flex' : 'none',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          {chat}
        </div>
      </div>
    </div>
  );
}
