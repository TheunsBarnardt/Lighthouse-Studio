'use client';

import { Check, Copy, Download } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';

import { getBlock } from '@/lib/blocks/registry';
import { getBlockSource } from '@/lib/blocks/sources';

interface CodeTabPanelProps {
  artifactId: string;
  insertedBlockIds: string[];
}

// Monaco is ~2MB; lazy-load on first open. Pattern mirrors the schema-designer
// CodeView and the SQL/Mongo editors elsewhere in this app.
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--muted-foreground)',
        fontSize: 12,
      }}
    >
      Loading editor…
    </div>
  ),
});

/**
 * Live code view for the current composition — Monaco-backed.
 *
 * Renders a single `Page.tsx` file built from:
 *   - the base page header (`// <ArtifactId>` + import block)
 *   - one exported component per inserted block (from BLOCK_SOURCES)
 *   - a default-export Page that composes them in order
 *
 * Monaco runs in real TypeScript mode (not jsx) — Objective 26 §0 locks
 * TSX/TS-only for all generated code. The editor surfaces TS diagnostics
 * inline; we extend `lib.dom` + `react` ambient types so `useState`, JSX,
 * `HTMLButtonElement`, etc. resolve without project context.
 */
export function CodeTabPanel({ artifactId, insertedBlockIds }: CodeTabPanelProps) {
  const [copied, setCopied] = useState(false);

  const fileSource = useMemo(
    () => buildPageSource(artifactId, insertedBlockIds),
    [artifactId, insertedBlockIds],
  );

  function copyAll() {
    if (typeof navigator === 'undefined') return;
    void navigator.clipboard.writeText(fileSource).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1500);
      return undefined;
    });
  }

  function download() {
    if (typeof window === 'undefined') return;
    const blob = new Blob([fileSource], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifactId}.tsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const handleMount = useCallback((_editor: unknown, monaco: unknown) => {
    type MonacoTsApi = {
      languages: {
        typescript: {
          typescriptDefaults: {
            setCompilerOptions(o: Record<string, unknown>): void;
            setDiagnosticsOptions(o: Record<string, unknown>): void;
            addExtraLib(content: string, filePath?: string): void;
          };
          JsxEmit: { Preserve: number };
          ScriptTarget: { ESNext: number };
          ModuleKind: { ESNext: number };
          ModuleResolutionKind: { NodeJs: number };
        };
      };
    };
    const ts = (monaco as MonacoTsApi).languages.typescript;
    ts.typescriptDefaults.setCompilerOptions({
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      jsx: ts.JsxEmit.Preserve,
      strict: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      noEmit: true,
      isolatedModules: true,
      skipLibCheck: true,
    });
    ts.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });
    // Minimal React types so JSX in the buffer doesn't show as a parse error.
    ts.typescriptDefaults.addExtraLib(
      `declare module 'react' {
         export type ReactNode = unknown;
         export type FC<P = unknown> = (props: P) => ReactNode;
         export function useState<T>(initial: T): [T, (next: T) => void];
         export function useEffect(fn: () => void | (() => void), deps?: unknown[]): void;
         export function useMemo<T>(fn: () => T, deps: unknown[]): T;
         export function useRef<T>(initial: T | null): { current: T | null };
       }
       declare namespace JSX {
         interface IntrinsicElements { [tag: string]: unknown; }
       }`,
      'file:///node_modules/@types/react/index.d.ts',
    );
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'var(--muted)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: 11,
              color: 'var(--foreground)',
            }}
          >
            {artifactId}.tsx
          </span>
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
            {insertedBlockIds.length} inserted block{insertedBlockIds.length === 1 ? '' : 's'}
          </span>
          <span
            style={{
              fontSize: 9,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'color-mix(in srgb, var(--primary) 14%, transparent)',
              color: 'var(--primary)',
              fontWeight: 600,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
            }}
          >
            TSX · TypeScript strict
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={copyAll} style={iconBtn(copied)} title="Copy file">
            {copied ? (
              <Check style={{ width: 12, height: 12 }} />
            ) : (
              <Copy style={{ width: 12, height: 12 }} />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" onClick={download} style={iconBtn(false)} title="Download .tsx">
            <Download style={{ width: 12, height: 12 }} />
            .tsx
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <MonacoEditor
          height="100%"
          defaultLanguage="typescript"
          path={`file:///${artifactId}.tsx`}
          value={fileSource}
          theme="vs-dark"
          onMount={handleMount}
          options={{
            readOnly: false,
            minimap: { enabled: false },
            fontSize: 12,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            renderLineHighlight: 'gutter',
            scrollbar: { useShadows: false },
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}

function iconBtn(active: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    fontSize: 11,
    border: '1px solid var(--border)',
    borderRadius: 4,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--foreground)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontFamily: 'inherit',
  };
}

/**
 * Build a single full Page.tsx file string from the composition.
 *
 * Each inserted block is included as its named export from BLOCK_SOURCES, then
 * referenced from the default `Page` component. The result compiles standalone
 * if dropped into a real Next/React project (no platform-specific imports).
 */
function buildPageSource(artifactId: string, insertedBlockIds: string[]): string {
  const seen = new Set<string>();
  const blocks: { name: string; component: string; source: string }[] = [];
  for (const id of insertedBlockIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const block = getBlock(id);
    const source = getBlockSource(id);
    if (!block || !source) continue;
    const component = inferComponentName(source) ?? toPascal(id);
    blocks.push({ name: block.name, component, source });
  }

  const header = `// ${artifactId}.tsx — generated by Lighthouse UI generation.
// Inserted blocks: ${blocks.length === 0 ? 'none' : blocks.map((b) => b.name).join(', ')}.
// All output is TSX with TypeScript strict — no JSX/JS variants per Objective 26 §0.

import type { ReactNode } from 'react';
`;

  const blockSection =
    blocks.length === 0
      ? `// No inserted blocks yet — drag from the Blocks tab or use Generate UI to compose.
`
      : blocks
          .map(
            (b) => `// ── ${b.name} ──────────────────────────────────────────────
${b.source}
`,
          )
          .join('\n');

  const componentRefs =
    blocks.length === 0
      ? '      <p>Base page · drop blocks in to see them composed here.</p>'
      : blocks.map((b) => `      <${b.component} />`).join('\n');

  const pageDecl = `export default function Page(): ReactNode {
  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950">
${componentRefs}
    </main>
  );
}
`;

  return `${header}\n${blockSection}\n${pageDecl}`;
}

function inferComponentName(source: string): string | undefined {
  const match = /export function (\w+)/.exec(source);
  return match ? match[1] : undefined;
}

function toPascal(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
