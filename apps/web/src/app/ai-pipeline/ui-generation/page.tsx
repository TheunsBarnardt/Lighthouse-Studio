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
import { NewPageDialog, type PageKind } from './dialogs/NewPageDialog';
import { A11yTabPanel } from './panels/A11yTabPanel';
import { BlocksPanel } from './panels/BlocksPanel';
import { CodeTabPanel } from './panels/CodeTabPanel';
import { DesignChatPanel } from './panels/DesignChatPanel';
import { LeftRailTabs } from './panels/LeftRailTabs';
import { PagesPanel } from './panels/PagesPanel';
import { PreviewIframePanel, type SelectedElement } from './panels/PreviewIframePanel';
import { VisualEditInspector } from './panels/VisualEditInspector';

type ViewTab = 'preview' | 'code' | 'a11y';

interface ComponentEntry {
  id: string;
  label: string;
  kind: MockArtifactId;
}

const INITIAL_COMPONENT_LIST: ComponentEntry[] = [
  { id: 'AppShell', label: 'AppShell', kind: 'AppShell' },
  { id: 'ContactsListPage', label: 'ContactsListPage', kind: 'ContactsListPage' },
  { id: 'ContactDetailPage', label: 'ContactDetailPage', kind: 'ContactDetailPage' },
  { id: 'Dashboard', label: 'Dashboard', kind: 'Dashboard' },
  { id: 'SignInPage', label: 'SignInPage', kind: 'SignInPage' },
];

type ChatEdit = { kind: 'edited' | 'inserted' | 'removed'; target: string };

export default function UiGenerationPage() {
  const [componentList, setComponentList] = useState<ComponentEntry[]>(INITIAL_COMPONENT_LIST);
  const [selectedComponent, setSelectedComponent] = useState<ComponentEntry>(() => {
    const dashboard = INITIAL_COMPONENT_LIST.find((c) => c.id === 'Dashboard');
    return dashboard ?? INITIAL_COMPONENT_LIST[0];
  });
  const [activeTab, setActiveTab] = useState<ViewTab>('preview');
  const [approvedSet, setApprovedSet] = useState<Set<string>>(new Set());

  const [selection, setSelection] = useState<SelectedElement | null>(null);
  const [pendingEdits, setPendingEdits] = useState<Record<string, EditMutation>>({});
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [chatEdits, setChatEdits] = useState<ChatEdit[]>([]);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [insertedBlockIds, setInsertedBlockIds] = useState<string[]>([]);
  const [chatAttention, setChatAttention] = useState(0);

  const applyEditRef = useRef<((editId: string, edit: EditMutation) => void) | null>(null);
  const insertBlockRef = useRef<((blockId: string) => void) | null>(null);
  const consumedPendingRef = useRef(false);

  const totalComponents = componentList.length;
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
  }, [reloadKey, selectedComponent.id]);

  const handleSelection = useCallback((sel: SelectedElement | null) => {
    setSelection(sel);
  }, []);

  function handleApprove() {
    setApprovedSet((prev) => new Set([...prev, selectedComponent.id]));
  }

  function handleSelectComponent(entry: ComponentEntry) {
    setSelectedComponent(entry);
    setSelection(null);
    setPendingEdits({});
    setChatEdits([]);
    setInsertedBlockIds([]);
    consumedPendingRef.current = false;
  }

  function handleCreatePage(input: { name: string; kind: PageKind }) {
    const entry: ComponentEntry = {
      id: `custom-${input.name}-${Date.now().toString(36)}`,
      label: input.name,
      kind: input.kind,
    };
    setComponentList((prev) => [...prev, entry]);
    handleSelectComponent(entry);
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
    setInsertedBlockIds((prev) => [...prev, blockId]);
    const block = getBlock(blockId);
    if (block) {
      setChatEdits((prev) => [...prev, { kind: 'inserted', target: block.name }]);
      setChatAttention((c) => c + 1);
    }
  }

  async function handleSave() {
    if (Object.keys(pendingEdits).length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/ai-pipeline/ui-generation/visual-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifactId: selectedComponent.kind, edits: pendingEdits }),
      });
      if (!res.ok) throw new Error(`save_failed_${String(res.status)}`);
      setPendingEdits({});
      setReloadKey((k) => k + 1);
      setSelection(null);
    } catch {
      // Surfaced via the saving-flag flicker; keep silent.
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
        {/* Left rail: tabbed — Pages / Blocks / Chat */}
        <div style={{ borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
          <LeftRailTabs
            pagesBadge={componentList.length}
            chatAttention={chatAttention}
            pages={
              <PagesPanel
                pages={componentList}
                selectedId={selectedComponent.id}
                onSelect={handleSelectComponent}
                onNew={() => {
                  setNewPageOpen(true);
                }}
                approvedSet={approvedSet}
              />
            }
            blocks={<BlocksPanel onInsert={handleInsertBlock} />}
            chat={
              <DesignChatPanel
                recentEdits={chatEdits.slice(-6)}
                onAssistantBlockInsert={handleInsertBlock}
              />
            }
          />
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
                <h1 style={{ fontSize: 18, margin: 0 }}>{selectedComponent.label}</h1>
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
                  disabled={approvedSet.has(selectedComponent.id)}
                >
                  {approvedSet.has(selectedComponent.id) ? '✓ Approved' : 'Approve'}
                </Button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 0 }}>
              {(['preview', 'code', 'a11y'] as ViewTab[]).map((tab) => (
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
                artifactId={selectedComponent.kind}
                onSelectionChange={handleSelection}
                reloadKey={reloadKey}
                applyEditRef={applyEditRef}
                insertBlockRef={insertBlockRef}
              />
            )}
            {activeTab === 'code' && (
              <CodeTabPanel
                artifactId={selectedComponent.label}
                insertedBlockIds={insertedBlockIds}
              />
            )}
            {activeTab === 'a11y' && (
              <A11yTabPanel artifactId={selectedComponent.kind} reloadKey={reloadKey} />
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
          // the GenerateUiDialog doesn't need to mirror it.
        }}
        onDone={() => {
          // Composition complete; chat banner already updated.
        }}
      />

      <NewPageDialog
        open={newPageOpen}
        onClose={() => {
          setNewPageOpen(false);
        }}
        onCreate={handleCreatePage}
        existingNames={componentList.map((c) => c.label)}
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
