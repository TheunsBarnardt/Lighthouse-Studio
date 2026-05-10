'use client';

import { create } from 'zustand';
import { produce } from 'immer';

import type { TokenRef, WorkspaceTheme } from '@/lib/theme/types';
import { buildThemeFromPreset, getPreset } from '@/lib/theme/preset-themes';
import { parseHslTuple, generateScale, formatHslTuple } from '@/lib/theme/color';

const HISTORY_LIMIT = 50;

interface HistoryEntry {
  label: string;
  theme: WorkspaceTheme;
}

interface ThemeEditorState {
  baseline: WorkspaceTheme | null;
  current: WorkspaceTheme | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  selectedMode: 'light' | 'dark';
  selectedTokenPath: string | null;
  hoveredSemanticKeys: string[];
  pinnedSemanticKeys: string[];
  cvdMode: 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  setInitial: (theme: WorkspaceTheme) => void;
  applyPreset: (presetId: string, user: string) => void;
  setSemanticRef: (mode: 'light' | 'dark', key: string, ref: TokenRef) => void;
  mirrorSemantic: (key: string, direction: 'light-to-dark' | 'dark-to-light', invertLiterals: boolean) => void;
  setPrimitiveColorBase: (group: string, tuple: string) => void;
  setPrimitiveColorStep: (group: string, step: string, tuple: string, manual: boolean) => void;
  regenerateScale: (group: string, preserveManual: boolean) => void;
  setSpacing: (key: string, value: string) => void;
  setRadius: (key: string, value: string) => void;
  setFont: (role: 'sans' | 'serif' | 'mono' | 'display', value: string) => void;
  setRadiusBase: (value: string) => void;
  setMode: (mode: 'light' | 'dark') => void;
  setSelected: (path: string | null) => void;
  setHovered: (keys: string[]) => void;
  togglePinned: (key: string) => void;
  setPinned: (keys: string[]) => void;
  clearPinned: () => void;
  setCvdMode: (mode: 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia') => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  isDirty: () => boolean;
}

function pushHistory(state: ThemeEditorState, label: string): HistoryEntry[] {
  if (!state.current) return state.past;
  const next = [...state.past, { label, theme: state.current }];
  return next.length > HISTORY_LIMIT ? next.slice(-HISTORY_LIMIT) : next;
}

function mutateTheme(
  state: ThemeEditorState,
  label: string,
  recipe: (draft: WorkspaceTheme) => void,
): Partial<ThemeEditorState> {
  if (!state.current) return {};
  const next = produce(state.current, recipe);
  next.source = 'custom';
  next.updatedAt = new Date().toISOString();
  return {
    past: pushHistory(state, label),
    future: [],
    current: next,
  };
}

export const useThemeEditor = create<ThemeEditorState>((set, get) => ({
  baseline: null,
  current: null,
  past: [],
  future: [],
  selectedMode: 'light',
  selectedTokenPath: null,
  hoveredSemanticKeys: [],
  pinnedSemanticKeys: [],
  cvdMode: 'normal',
  setInitial: (theme) =>
    set({ baseline: theme, current: theme, past: [], future: [] }),
  applyPreset: (presetId, user) => {
    const preset = getPreset(presetId);
    if (!preset) return;
    const next = buildThemeFromPreset(preset, { user });
    set((s) => ({
      past: pushHistory(s, `Applied preset: ${preset.label}`),
      future: [],
      baseline: next,
      current: next,
    }));
  },
  setSemanticRef: (mode, key, ref) =>
    set((s) =>
      mutateTheme(s, `Set ${mode}/${key}`, (d) => {
        d.semantics[mode][key] = ref;
      }),
    ),
  mirrorSemantic: (key, direction, invertLiterals) =>
    set((s) =>
      mutateTheme(s, `Mirror ${direction} for ${key}`, (d) => {
        const [from, to]: ['light' | 'dark', 'light' | 'dark'] =
          direction === 'light-to-dark' ? ['light', 'dark'] : ['dark', 'light'];
        const source = d.semantics[from][key] as (typeof d.semantics)[typeof from][string] | undefined;
        if (source === undefined) return;
        if ('ref' in source) {
          d.semantics[to][key] = { ref: source.ref };
        } else if (invertLiterals) {
          try {
            const hsl = parseHslTuple(source.value);
            const inverted = formatHslTuple({ ...hsl, l: Math.max(0, Math.min(100, 100 - hsl.l)) });
            d.semantics[to][key] = { value: inverted };
          } catch {
            d.semantics[to][key] = { value: source.value };
          }
        } else {
          d.semantics[to][key] = { value: source.value };
        }
      }),
    ),
  setPrimitiveColorBase: (group, tuple) =>
    set((s) =>
      mutateTheme(s, `Set primitive ${group} base`, (d) => {
        const scale = d.primitives.colors[group] as (typeof d.primitives.colors)[string] | undefined;
        if (scale === undefined) return;
        scale.base = tuple;
      }),
    ),
  setPrimitiveColorStep: (group, step, tuple, manual) =>
    set((s) =>
      mutateTheme(s, `Set ${group}/${step}`, (d) => {
        const scale = d.primitives.colors[group] as (typeof d.primitives.colors)[string] | undefined;
        if (scale === undefined) return;
        scale.steps[step] = tuple;
        scale.manual = scale.manual ?? {};
        scale.manual[step] = manual;
      }),
    ),
  regenerateScale: (group, preserveManual) =>
    set((s) =>
      mutateTheme(s, `Regenerate ${group} scale`, (d) => {
        const scale = d.primitives.colors[group] as (typeof d.primitives.colors)[string] | undefined;
        if (scale === undefined) return;
        const base = parseHslTuple(scale.base);
        const fresh = generateScale(base);
        for (const [step, hsl] of Object.entries(fresh)) {
          if (preserveManual && scale.manual?.[step]) continue;
          scale.steps[step] = formatHslTuple(hsl);
          if (scale.manual) scale.manual[step] = false;
        }
      }),
    ),
  setSpacing: (key, value) =>
    set((s) =>
      mutateTheme(s, `Set spacing ${key}`, (d) => {
        d.primitives.spacing[key] = value;
      }),
    ),
  setRadius: (key, value) =>
    set((s) =>
      mutateTheme(s, `Set radius ${key}`, (d) => {
        d.primitives.radius[key] = value;
      }),
    ),
  setFont: (role, value) =>
    set((s) =>
      mutateTheme(s, `Set font ${role}`, (d) => {
        d.fonts[role] = value;
      }),
    ),
  setRadiusBase: (value) =>
    set((s) =>
      mutateTheme(s, 'Set radius base', (d) => {
        d.radiusBase = value;
      }),
    ),
  setMode: (mode) => set({ selectedMode: mode }),
  setSelected: (path) => set({ selectedTokenPath: path }),
  setHovered: (keys) => set({ hoveredSemanticKeys: keys }),
  togglePinned: (key) =>
    set((s) => ({
      pinnedSemanticKeys: s.pinnedSemanticKeys.includes(key)
        ? s.pinnedSemanticKeys.filter((k) => k !== key)
        : [...s.pinnedSemanticKeys, key],
    })),
  setPinned: (keys) => set({ pinnedSemanticKeys: keys }),
  clearPinned: () => set({ pinnedSemanticKeys: [] }),
  setCvdMode: (mode) => set({ cvdMode: mode }),
  undo: () =>
    set((s) => {
      const last = s.past.at(-1);
      if (last === undefined || s.current === null) return {};
      return {
        past: s.past.slice(0, -1),
        future: [{ label: last.label, theme: s.current }, ...s.future],
        current: last.theme,
      };
    }),
  redo: () =>
    set((s) => {
      const [next, ...rest] = s.future;
      if (next === undefined || s.current === null) return {};
      return {
        past: [...s.past, { label: next.label, theme: s.current }],
        future: rest,
        current: next.theme,
      };
    }),
  reset: () => {
    const baseline = get().baseline;
    if (!baseline) return;
    set({ current: baseline, past: [], future: [] });
  },
  isDirty: () => {
    const { current, baseline } = get();
    if (!current || !baseline) return false;
    return JSON.stringify(current) !== JSON.stringify(baseline);
  },
}));
