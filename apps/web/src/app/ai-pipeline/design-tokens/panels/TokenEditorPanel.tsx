'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, RefreshCw, AlertTriangle } from 'lucide-react';

interface TokenEditorPanelProps {
  tokenSet: Record<string, unknown>;
  selectedTokenPath: string | null;
  onSelectToken: (path: string) => void;
  onEditToken: (path: string, value: unknown) => void;
  onRegenerateCategory: (category: string) => void;
}

const CATEGORIES = ['colors', 'typography', 'spacing', 'borderRadius', 'shadows', 'motion', 'zIndex', 'breakpoints'] as const;

export function TokenEditorPanel({
  tokenSet, selectedTokenPath, onSelectToken, onEditToken, onRegenerateCategory,
}: TokenEditorPanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['colors']));
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const toggle = (cat: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const startEdit = (path: string, currentValue: unknown) => {
    setEditingPath(path);
    setEditValue(String(currentValue));
  };

  const commitEdit = () => {
    if (!editingPath) return;
    onEditToken(editingPath, editValue);
    setEditingPath(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b">
        <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Token Editor</h2>
      </div>
      <div className="flex-1 overflow-auto">
        {CATEGORIES.map(cat => {
          const catTokens = tokenSet[cat];
          if (!catTokens) return null;
          const isExpanded = expanded.has(cat);
          return (
            <div key={cat} className="border-b">
              <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => toggle(cat)}>
                <div className="flex items-center gap-1.5">
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                  <span className="text-sm font-medium text-gray-700 capitalize">{cat}</span>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); onRegenerateCategory(cat); }}
                  title="Regenerate this category"
                  className="text-gray-400 hover:text-blue-500 p-0.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              {isExpanded && (
                <div className="pb-2">
                  <TokenTree
                    prefix={cat}
                    value={catTokens as Record<string, unknown>}
                    selectedPath={selectedTokenPath}
                    editingPath={editingPath}
                    editValue={editValue}
                    onSelectToken={onSelectToken}
                    onStartEdit={startEdit}
                    onEditValueChange={setEditValue}
                    onCommitEdit={commitEdit}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TokenTreeProps {
  prefix: string;
  value: Record<string, unknown>;
  selectedPath: string | null;
  editingPath: string | null;
  editValue: string;
  onSelectToken: (path: string) => void;
  onStartEdit: (path: string, current: unknown) => void;
  onEditValueChange: (v: string) => void;
  onCommitEdit: () => void;
}

function TokenTree({ prefix, value, selectedPath, editingPath, editValue, onSelectToken, onStartEdit, onEditValueChange, onCommitEdit }: TokenTreeProps) {
  return (
    <>
      {Object.entries(value).map(([k, v]) => {
        const path = `${prefix}.${k}`;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          return (
            <div key={k} className="ml-3">
              <div className="px-3 py-0.5 text-xs font-medium text-gray-500">{k}</div>
              <TokenTree
                prefix={path} value={v as Record<string, unknown>}
                selectedPath={selectedPath} editingPath={editingPath} editValue={editValue}
                onSelectToken={onSelectToken} onStartEdit={onStartEdit}
                onEditValueChange={onEditValueChange} onCommitEdit={onCommitEdit}
              />
            </div>
          );
        }
        const isHex = typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
        const isSelected = selectedPath === path;
        const isEditing = editingPath === path;
        return (
          <div
            key={k}
            className={`flex items-center gap-2 px-3 py-1 mx-1 rounded cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
            onClick={() => onSelectToken(path)}
          >
            {isHex && (
              <div className="w-4 h-4 rounded flex-shrink-0 border border-gray-200" style={{ backgroundColor: v as string }} />
            )}
            <span className="text-xs text-gray-600 flex-1 truncate" title={k}>{k}</span>
            {isEditing ? (
              <input
                autoFocus
                value={editValue}
                onChange={e => onEditValueChange(e.target.value)}
                onBlur={onCommitEdit}
                onKeyDown={e => { if (e.key === 'Enter') onCommitEdit(); if (e.key === 'Escape') onCommitEdit(); }}
                className="w-24 text-xs border border-blue-400 rounded px-1 py-0.5 focus:outline-none"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className="text-xs text-gray-400 truncate max-w-[7rem] hover:text-gray-700"
                title={String(v)}
                onDoubleClick={e => { e.stopPropagation(); onStartEdit(path, v); }}
              >
                {String(v)}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
