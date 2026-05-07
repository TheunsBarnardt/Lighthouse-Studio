'use client';

import { useEffect, useRef, useState } from 'react';

const DEMO_LOG_LINES = [
  { ts: '14:32:01', level: 'info', step: 'pre_flight', msg: 'Environment preflight check started' },
  { ts: '14:32:01', level: 'info', step: 'pre_flight', msg: 'Database connectivity: OK' },
  { ts: '14:32:01', level: 'info', step: 'pre_flight', msg: 'Runtime health: OK' },
  { ts: '14:32:02', level: 'info', step: 'pre_flight', msg: 'Preflight checks passed (3/3)' },
  { ts: '14:32:03', level: 'info', step: 'schema', msg: 'Applying 2 schema migrations' },
  { ts: '14:32:03', level: 'info', step: 'schema', msg: 'Migration 1/2: Add deal_score column' },
  { ts: '14:32:04', level: 'info', step: 'schema', msg: 'Migration 1/2: Complete (342ms)' },
  { ts: '14:32:04', level: 'info', step: 'schema', msg: 'Migration 2/2: Create activities index' },
  { ts: '14:32:05', level: 'info', step: 'schema', msg: 'Migration 2/2: Complete (580ms)' },
  { ts: '14:32:06', level: 'info', step: 'server', msg: 'Deploying server functions bundle (v0.0.1)' },
  { ts: '14:32:07', level: 'info', step: 'server', msg: 'Bundle uploaded (2.4 MB)' },
  { ts: '14:32:08', level: 'info', step: 'server', msg: 'Runtime reloaded: 5 functions active' },
  { ts: '14:32:09', level: 'info', step: 'ui', msg: 'Deploying UI bundle (v0.0.1)' },
  { ts: '14:32:10', level: 'info', step: 'ui', msg: 'Bundle uploaded (1.8 MB)' },
  { ts: '14:32:10', level: 'info', step: 'ui', msg: 'Cache invalidated' },
  { ts: '14:32:11', level: 'info', step: 'health_check', msg: 'Running health checks (timeout: 60s)' },
  { ts: '14:32:11', level: 'info', step: 'health_check', msg: 'GET /api/health → 200 (42ms)' },
  { ts: '14:32:11', level: 'info', step: 'health_check', msg: 'GET / → 200 (88ms)' },
  { ts: '14:32:12', level: 'info', step: 'health_check', msg: 'All health checks passed' },
  { ts: '14:32:12', level: 'info', step: 'cleanup', msg: 'Deployment complete. Environment: dev. Version: v0.0.1' },
];

const LEVEL_STYLES: Record<string, string> = {
  info: 'text-foreground',
  warn: 'text-amber-600',
  error: 'text-red-600',
};

interface Props {
  deploymentId: string;
}

export function LogsPanel({ deploymentId }: Props) {
  const [visibleLines, setVisibleLines] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i >= DEMO_LOG_LINES.length) { clearInterval(interval); return; }
      setVisibleLines(v => v + 1);
      i++;
    }, 300);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleLines]);

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100">
      <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-2">
        <span className="text-xs text-gray-400 font-mono">deployment/{deploymentId}</span>
        <span className="text-xs text-gray-600 ml-auto">{visibleLines}/{DEMO_LOG_LINES.length} lines</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
        {DEMO_LOG_LINES.slice(0, visibleLines).map((line, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-gray-600 shrink-0 w-16">{line.ts}</span>
            <span className="text-gray-500 shrink-0 w-16">[{line.step}]</span>
            <span className={LEVEL_STYLES[line.level]}>{line.msg}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
