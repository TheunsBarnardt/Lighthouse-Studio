'use client';

import { useState } from 'react';

interface ExplainPanelProps {
  plan: unknown;
  format: 'json' | 'xml' | 'text';
  durationMs: number;
}

function JsonTree({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (value === null || typeof value !== 'object') {
    return <span className="text-green-600 dark:text-green-400">{JSON.stringify(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (!expanded) {
      return (
        <button
          type="button"
          onClick={() => { setExpanded(true); }}
          className="text-blue-500 hover:underline"
        >
          [{value.length} items]
        </button>
      );
    }
    return (
      <div className="pl-4">
        {value.map((item, i) => (
          // biome-ignore lint: index key is fine for static plan trees
          <div key={i} className="border-l pl-2">
            <JsonTree value={item} depth={depth + 1} />
          </div>
        ))}
        <button type="button" onClick={() => { setExpanded(false); }} className="text-xs text-muted-foreground hover:underline">
          collapse
        </button>
      </div>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => { setExpanded(true); }}
        className="text-blue-500 hover:underline"
      >
        &#123;{entries.length} keys&#125;
      </button>
    );
  }

  return (
    <div className="pl-4">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-1 border-l pl-2">
          <span className="text-purple-600 dark:text-purple-400 shrink-0">{k}:</span>
          <JsonTree value={v} depth={depth + 1} />
        </div>
      ))}
      <button type="button" onClick={() => { setExpanded(false); }} className="text-xs text-muted-foreground hover:underline">
        collapse
      </button>
    </div>
  );
}

export function ExplainPanel({ plan, format, durationMs }: ExplainPanelProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-4 border-b px-3 py-1 text-xs text-muted-foreground">
        <span>Query plan ({format})</span>
        <span className="ml-auto">{durationMs}ms</span>
      </div>
      <div className="flex-1 overflow-auto p-3 font-mono text-xs">
        {format === 'json' ? (
          <JsonTree value={plan} />
        ) : (
          <pre className="whitespace-pre-wrap">{String(plan)}</pre>
        )}
      </div>
    </div>
  );
}
