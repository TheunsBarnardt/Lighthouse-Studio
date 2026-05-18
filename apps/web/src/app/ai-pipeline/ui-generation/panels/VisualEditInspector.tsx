'use client';

import { useEffect, useState } from 'react';

import type { EditMutation } from '@/app/preview/protocol';

import type { SelectedElement } from './PreviewIframePanel';

interface VisualEditInspectorProps {
  selection: SelectedElement | null;
  pendingEdits: Record<string, EditMutation>;
  /** Pushes an optimistic edit into the iframe. */
  onApply: (editId: string, edit: EditMutation) => void;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
}

const QUICK_TEXT_COLORS = [
  { label: 'Default', cls: 'text-zinc-900' },
  { label: 'Muted', cls: 'text-zinc-500' },
  { label: 'Brand', cls: 'text-blue-600' },
  { label: 'Success', cls: 'text-emerald-600' },
  { label: 'Danger', cls: 'text-red-600' },
];

const QUICK_BG_COLORS = [
  { label: 'None', cls: '' },
  { label: 'Brand', cls: 'bg-blue-600' },
  { label: 'Muted', cls: 'bg-zinc-100' },
  { label: 'Success', cls: 'bg-emerald-600' },
  { label: 'Danger', cls: 'bg-red-600' },
];

const QUICK_FONT_WEIGHT = [
  { label: 'Normal', cls: 'font-normal' },
  { label: 'Medium', cls: 'font-medium' },
  { label: 'Semibold', cls: 'font-semibold' },
  { label: 'Bold', cls: 'font-bold' },
];

function classGroup(prefix: string, className: string): string[] {
  return className.split(/\s+/).filter((c) => c.startsWith(prefix));
}

export function VisualEditInspector({
  selection,
  pendingEdits,
  onApply,
  onSave,
  onDiscard,
  saving,
}: VisualEditInspectorProps) {
  const [textDraft, setTextDraft] = useState('');
  const [classDraft, setClassDraft] = useState('');

  useEffect(() => {
    setTextDraft(selection?.textContent.trim().slice(0, 200) ?? '');
    setClassDraft('');
  }, [selection?.editId, selection?.textContent]);

  if (!selection) {
    return (
      <div
        style={{
          padding: 16,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          color: 'var(--muted-foreground)',
          fontSize: 12,
        }}
      >
        Click an element in the preview to edit it.
      </div>
    );
  }

  const { editId, tagName, className } = selection;
  const dirty = Object.keys(pendingEdits).length > 0;

  function commitText() {
    if (textDraft !== selection?.textContent.trim()) {
      onApply(editId, { text: textDraft });
    }
  }

  function swapClassPrefix(prefix: string, nextClass: string) {
    const current = classGroup(prefix, className);
    const removeClass = current.filter((c) => c !== nextClass);
    const addClass = nextClass && !current.includes(nextClass) ? [nextClass] : [];
    if (removeClass.length === 0 && addClass.length === 0) return;
    onApply(editId, { removeClass, addClass });
  }

  function addCustomClass() {
    const trimmed = classDraft.trim();
    if (!trimmed) return;
    onApply(editId, { addClass: trimmed.split(/\s+/) });
    setClassDraft('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'var(--card)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--muted-foreground)',
              fontWeight: 600,
            }}
          >
            Selected · {tagName}
          </div>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: 'var(--foreground)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={editId}
          >
            {editId}
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <Section label="Text">
          <textarea
            value={textDraft}
            onChange={(e) => {
              setTextDraft(e.target.value);
            }}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.currentTarget.blur();
              }
            }}
            rows={3}
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              fontSize: 12,
              resize: 'vertical',
              fontFamily: 'inherit',
              background: 'var(--background)',
              color: 'var(--foreground)',
            }}
            placeholder="Element text (commit on blur or Ctrl+Enter)"
          />
        </Section>

        <Section label="Text color">
          <ChipRow>
            {QUICK_TEXT_COLORS.map((c) => (
              <Chip
                key={c.cls}
                active={className.split(/\s+/).includes(c.cls)}
                onClick={() => {
                  swapClassPrefix('text-', c.cls);
                }}
              >
                {c.label}
              </Chip>
            ))}
          </ChipRow>
        </Section>

        <Section label="Background">
          <ChipRow>
            {QUICK_BG_COLORS.map((c) => (
              <Chip
                key={c.label}
                active={
                  c.cls === ''
                    ? classGroup('bg-', className).length === 0
                    : className.split(/\s+/).includes(c.cls)
                }
                onClick={() => {
                  swapClassPrefix('bg-', c.cls);
                }}
              >
                {c.label}
              </Chip>
            ))}
          </ChipRow>
        </Section>

        <Section label="Font weight">
          <ChipRow>
            {QUICK_FONT_WEIGHT.map((c) => (
              <Chip
                key={c.cls}
                active={className.split(/\s+/).includes(c.cls)}
                onClick={() => {
                  swapClassPrefix('font-', c.cls);
                }}
              >
                {c.label}
              </Chip>
            ))}
          </ChipRow>
        </Section>

        <Section label="Add Tailwind class">
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={classDraft}
              onChange={(e) => {
                setClassDraft(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomClass();
                }
              }}
              placeholder="e.g. rounded-xl shadow-md"
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                fontSize: 12,
                fontFamily: 'monospace',
                background: 'var(--background)',
                color: 'var(--foreground)',
              }}
            />
            <button
              type="button"
              onClick={addCustomClass}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: 'var(--accent)',
                color: 'var(--primary)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Add
            </button>
          </div>
        </Section>

        <Section label="Current classes">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {className
              .split(/\s+/)
              .filter(Boolean)
              .map((c) => (
                <span
                  key={c}
                  onClick={() => {
                    onApply(editId, { removeClass: [c] });
                  }}
                  title="Click to remove"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'monospace',
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 3,
                    border: '1px solid var(--border)',
                    background: 'var(--muted)',
                    cursor: 'pointer',
                  }}
                >
                  {c}
                  <span style={{ opacity: 0.6 }}>×</span>
                </span>
              ))}
            {className.trim() === '' && (
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                No classes on this element.
              </span>
            )}
          </div>
        </Section>
      </div>

      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--card)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
          {dirty
            ? `${String(Object.keys(pendingEdits).length)} pending edit${Object.keys(pendingEdits).length === 1 ? '' : 's'}`
            : 'No changes'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={onDiscard}
            disabled={!dirty || saving}
            style={{
              padding: '5px 10px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--muted-foreground)',
              fontSize: 12,
              cursor: dirty && !saving ? 'pointer' : 'not-allowed',
              opacity: dirty && !saving ? 1 : 0.5,
            }}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            style={{
              padding: '5px 12px',
              borderRadius: 4,
              border: 'none',
              background: dirty && !saving ? 'var(--primary)' : 'var(--muted)',
              color: dirty && !saving ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
              fontSize: 12,
              fontWeight: 500,
              cursor: dirty && !saving ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Saving…' : 'Save edits'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--muted-foreground)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{children}</div>;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '3px 8px',
        borderRadius: 3,
        border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--foreground)',
        fontSize: 11,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}
