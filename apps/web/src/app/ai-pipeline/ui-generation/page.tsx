'use client';

import { Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { MockArtifactId } from '@/app/preview/mock-components';
import type { EditMutation } from '@/app/preview/protocol';

import { Button } from '@/components/ui/button';
import { getBlock } from '@/lib/blocks/registry';
import { mergeMutation } from '@/lib/visual-edits/edit-overlay';

import { PipelineStepper } from '../stepper';
import { GenerateUiDialog } from './dialogs/GenerateUiDialog';
import { BlocksPanel } from './panels/BlocksPanel';
import { DesignChatPanel } from './panels/DesignChatPanel';
import { PreviewIframePanel, type SelectedElement } from './panels/PreviewIframePanel';
import { VisualEditInspector } from './panels/VisualEditInspector';

type ViewTab = 'preview' | 'code' | 'storybook' | 'a11y';

const COMPONENT_LIST: { id: MockArtifactId; label: string }[] = [
  { id: 'AppShell', label: 'AppShell' },
  { id: 'ContactsListPage', label: 'ContactsListPage' },
  { id: 'ContactDetailPage', label: 'ContactDetailPage' },
  { id: 'Dashboard', label: 'Dashboard' },
  { id: 'SignInPage', label: 'SignInPage' },
];

type ChatEdit = { kind: 'edited' | 'inserted' | 'removed'; target: string };

export default function UiGenerationPage() {
  const [selectedComponent, setSelectedComponent] = useState<MockArtifactId>('Dashboard');
  const [activeTab, setActiveTab] = useState<ViewTab>('preview');
  const [approvedSet, setApprovedSet] = useState<Set<string>>(new Set());

  const [selection, setSelection] = useState<SelectedElement | null>(null);
  const [pendingEdits, setPendingEdits] = useState<Record<string, EditMutation>>({});
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [chatEdits, setChatEdits] = useState<ChatEdit[]>([]);
  const [generateOpen, setGenerateOpen] = useState(false);

  const applyEditRef = useRef<((editId: string, edit: EditMutation) => void) | null>(null);
  const insertBlockRef = useRef<((blockId: string) => void) | null>(null);
  const consumedPendingRef = useRef(false);

  const totalComponents = COMPONENT_LIST.length;
  const approvedCount = approvedSet.size;

  // Pick up blocks queued from `/blocks/[id]` ("Add to UI generation") and
  // insert them into the iframe once it's ready. The localStorage key is the
  // Phase 1 handoff; Phase 2 (this change) actually inserts.
  useEffect(() => {
    if (typeof window === 'undefined' || consumedPendingRef.current) return;
    try {
      const raw = window.localStorage.getItem('lighthouse.pendingBlocks');
      const ids = raw ? (JSON.parse(raw) as string[]) : [];
      if (ids.length === 0) return;
      // Defer until the iframe has wired up its insertBlock handle.
      const t = setTimeout(() => {
        for (const id of ids) {
          insertBlockRef.current?.(id);
          const block = getBlock(id);
          if (block) {
            setChatEdits((prev) => [...prev, { kind: 'inserted', target: block.name }]);
          }
        }
        window.localStorage.removeItem('lighthouse.pendingBlocks');
        consumedPendingRef.current = true;
      }, 400);
      return () => {
        clearTimeout(t);
      };
    } catch {
      // ignore
    }
  }, [reloadKey, selectedComponent]);

  const handleSelection = useCallback((sel: SelectedElement | null) => {
    setSelection(sel);
  }, []);

  function handleApprove() {
    setApprovedSet((prev) => new Set([...prev, selectedComponent]));
  }

  function handleSelectComponent(id: MockArtifactId) {
    setSelectedComponent(id);
    setSelection(null);
    setPendingEdits({});
    setChatEdits([]);
    consumedPendingRef.current = false;
  }

  function handleApplyEdit(editId: string, edit: EditMutation) {
    applyEditRef.current?.(editId, edit);
    setPendingEdits((prev) => mergeMutation(prev, editId, edit));
    setSelection((prev) => {
      if (!prev || prev.editId !== editId) return prev;
      let className = prev.className;
      if (typeof edit.setClass === 'string') {
        className = edit.setClass;
      }
      const classes = new Set(className.split(/\s+/).filter(Boolean));
      if (edit.removeClass) for (const c of edit.removeClass) classes.delete(c);
      if (edit.addClass) for (const c of edit.addClass) classes.add(c);
      return {
        ...prev,
        className: [...classes].join(' '),
        textContent: typeof edit.text === 'string' ? edit.text : prev.textContent,
      };
    });
    setChatEdits((prev) => [...prev, { kind: 'edited', target: editId }]);
  }

  function handleInsertBlock(blockId: string) {
    insertBlockRef.current?.(blockId);
    const block = getBlock(blockId);
    if (block) {
      setChatEdits((prev) => [...prev, { kind: 'inserted', target: block.name }]);
    }
  }

  async function handleSave() {
    if (Object.keys(pendingEdits).length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/ai-pipeline/ui-generation/visual-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifactId: selectedComponent, edits: pendingEdits }),
      });
      if (!res.ok) throw new Error(`save_failed_${String(res.status)}`);
      setPendingEdits({});
      setReloadKey((k) => k + 1);
      setSelection(null);
    } catch {
      // Surfaced via the saving-flag flicker; keep silent so console isn't spammed.
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setPendingEdits({});
    setReloadKey((k) => k + 1);
    setSelection(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PipelineStepper active="ui-gen" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 320px',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Left rail: top → component list, middle → blocks, bottom → chat */}
        <div
          style={{
            borderRight: '1px solid var(--border)',
            display: 'grid',
            gridTemplateRows: 'auto minmax(140px, 1fr) minmax(220px, 1fr)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
              overflowY: 'auto',
              maxHeight: 200,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--muted-foreground)',
                marginBottom: 6,
              }}
            >
              Components
            </div>
            {COMPONENT_LIST.map((item) => {
              const isApproved = approvedSet.has(item.id);
              const isActive = item.id === selectedComponent;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    handleSelectComponent(item.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    width: '100%',
                    textAlign: 'left',
                    padding: '4px 8px',
                    borderRadius: 4,
                    marginBottom: 1,
                    background: isActive ? 'var(--accent)' : 'transparent',
                    color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    fontSize: 11,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isApproved ? 'oklch(0.40 0.14 145)' : 'var(--border)',
                      flexShrink: 0,
                    }}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div style={{ borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
            <BlocksPanel onInsert={handleInsertBlock} />
          </div>

          <div style={{ overflow: 'hidden' }}>
            <DesignChatPanel
              recentEdits={chatEdits.slice(-6)}
              onAssistantBlockInsert={handleInsertBlock}
            />
          </div>
        </div>

        {/* Center: preview */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            style={{
              padding: '12px 20px',
              flexShrink: 0,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 8,
              }}
            >
              <div>
                <h1 style={{ fontSize: 18, margin: 0 }}>{selectedComponent}</h1>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                  Drag blocks in · click elements to edit · ask the AI to change the design
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => {
                    setGenerateOpen(true);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Sparkles style={{ width: 12, height: 12 }} />
                  Generate UI
                </Button>
                <Button variant="outline" size="sm" type="button">
                  Regenerate
                </Button>
                <Button
                  size="sm"
                  type="button"
                  onClick={handleApprove}
                  disabled={approvedSet.has(selectedComponent)}
                >
                  {approvedSet.has(selectedComponent) ? '✓ Approved' : 'Approve'}
                </Button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 0 }}>
              {(['preview', 'code', 'storybook', 'a11y'] as ViewTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab);
                  }}
                  style={{
                    padding: '5px 14px',
                    fontSize: 12,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    color: activeTab === tab ? 'var(--primary)' : 'var(--muted-foreground)',
                    borderBottom:
                      activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                    fontWeight: activeTab === tab ? 500 : 400,
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab === 'preview' && (
              <PreviewIframePanel
                artifactId={selectedComponent}
                onSelectionChange={handleSelection}
                reloadKey={reloadKey}
                applyEditRef={applyEditRef}
                insertBlockRef={insertBlockRef}
              />
            )}
            {activeTab === 'code' && (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  color: 'var(--muted-foreground)',
                }}
              >
                Code view — wires up when real artifact generation lands.
              </div>
            )}
            {(activeTab === 'storybook' || activeTab === 'a11y') && (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  color: 'var(--muted-foreground)',
                }}
              >
                {activeTab === 'storybook'
                  ? 'Storybook story would render here'
                  : 'Axe-core a11y report: pending'}
              </div>
            )}
          </div>
        </div>

        {/* Right: inspector */}
        <div style={{ borderLeft: '1px solid var(--border)', overflow: 'hidden' }}>
          <VisualEditInspector
            selection={selection}
            pendingEdits={pendingEdits}
            onApply={handleApplyEdit}
            onSave={() => {
              void handleSave();
            }}
            onDiscard={handleDiscard}
            saving={saving}
          />
        </div>
      </div>

      <GenerateUiDialog
        open={generateOpen}
        onClose={() => {
          setGenerateOpen(false);
        }}
        onBlock={(blockId) => {
          handleInsertBlock(blockId);
        }}
        onReasoning={(text) => {
          setChatEdits((prev) => [...prev, { kind: 'edited', target: text.slice(0, 64) }]);
        }}
        onAssistantDelta={() => {
          // Streaming text is rendered in the chat panel via its own send flow;
          // the GenerateUiDialog doesn't need to mirror it. Kept for future use.
        }}
        onDone={() => {
          // Composition complete; chat banner already updated.
        }}
      />

      <div
        style={{
          padding: '6px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 11,
          color: 'var(--muted-foreground)',
          flexShrink: 0,
        }}
      >
        <span>
          {approvedCount}/{totalComponents} components approved
        </span>
        <div
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: 'var(--muted)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              background: 'var(--primary)',
              width: `${String((approvedCount / Math.max(1, totalComponents)) * 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
