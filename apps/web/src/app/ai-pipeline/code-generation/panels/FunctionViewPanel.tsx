'use client';

import { useState } from 'react';

type TabId = 'code' | 'manifest' | 'analysis' | 'reasoning';

interface Fn {
  id: string;
  name: string;
  triggerType: string;
  status: string;
  staticAnalysisPassed: boolean;
  typeCheckPassed: boolean;
}

const MOCK_SOURCE = `import type { FunctionContext } from '@platform/runtime';
import { z } from 'zod';
import { NotFoundError } from '@platform/runtime/errors';

const InputSchema = z.object({
  contactId: z.string().uuid(),
  newScore: z.number().min(0).max(100),
});

export async function updateContactScore(rawInput: unknown, ctx: FunctionContext) {
  const input = InputSchema.parse(rawInput);
  const { sdk, logger } = ctx;

  logger.info('Updating contact score', { contactId: input.contactId });

  const contact = await sdk.data('contacts').where({ id: { _eq: input.contactId } }).one();
  if (!contact) throw new NotFoundError(\`Contact \${input.contactId} not found\`);

  const previousScore = contact.score as number;
  await sdk.data('contacts').where({ id: { _eq: input.contactId } }).update({ score: input.newScore });

  if (input.newScore > 80 && previousScore <= 80) {
    await sdk.functions.notifyHighValueContact({ contactId: input.contactId });
  }

  return { success: true, contactId: input.contactId, previousScore };
}

export const manifest = {
  name: 'update_contact_score',
  trigger: { type: 'http', method: 'POST', path: '/contacts/:id/score' },
  permissions: ['data_table.read', 'data_table.write', 'functions.invoke'],
  secrets: [],
  rateLimit: { requestsPerMinute: 100 },
  timeout: 30000,
  memoryMb: 256,
};`;

interface FunctionViewPanelProps {
  fn: Fn;
  onApprove: () => void;
  onRegenerate: () => void;
  onRollback: () => void;
}

export function FunctionViewPanel({ fn, onApprove, onRegenerate, onRollback }: FunctionViewPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('code');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'code', label: 'Code' },
    { id: 'manifest', label: 'Manifest' },
    { id: 'analysis', label: `Analysis ${fn.staticAnalysisPassed ? '✓' : '!'}` },
    { id: 'reasoning', label: 'Reasoning' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-4 py-2 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground">{fn.name}.ts</span>
          <span className="text-xs text-muted-foreground">
            {fn.typeCheckPassed ? 'TypeScript ✓' : 'TypeScript ✗'}
            {' · '}
            {fn.staticAnalysisPassed ? 'Static ✓' : 'Static ✗'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRollback} className="text-xs px-2 py-1 border border-border rounded hover:bg-muted">
            ↩ Rollback
          </button>
          <button onClick={onRegenerate} className="text-xs px-2 py-1 border border-border rounded hover:bg-muted">
            ↻ Regenerate
          </button>
          {fn.status !== 'approved' && (
            <button onClick={onApprove} className="text-xs px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700">
              ✓ Approve
            </button>
          )}
          {fn.status === 'approved' && (
            <span className="text-xs px-2.5 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
              ✓ Approved
            </span>
          )}
        </div>
      </div>

      <div className="flex border-b border-border bg-background px-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-2 px-3 text-xs font-medium ${activeTab === tab.id ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'code' && (
          <table className="w-full text-xs font-mono">
            <tbody>
              {MOCK_SOURCE.split('\n').map((line, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="select-none w-12 text-right pr-4 text-muted-foreground border-r border-border/30 py-0.5 pl-2">{i + 1}</td>
                  <td className="pl-4 py-0.5 whitespace-pre text-foreground">{line || ' '}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'manifest' && (
          <div className="p-4">
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-4">
{JSON.stringify({
  name: fn.name,
  trigger: { type: fn.triggerType, method: 'POST', path: `/${fn.name.replace(/_/g, '-')}` },
  permissions: ['data_table.read', 'data_table.write'],
  secrets: [],
  rateLimit: { requestsPerMinute: 100 },
  timeout: 30000,
  memoryMb: 256,
}, null, 2)}
            </pre>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="p-4 space-y-3">
            <div className={`flex items-center gap-2 p-3 rounded-lg border ${fn.staticAnalysisPassed ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20'}`}>
              <span className="text-sm">{fn.staticAnalysisPassed ? '✓' : '✗'}</span>
              <div>
                <p className="text-xs font-medium text-foreground">Static Analysis</p>
                <p className="text-xs text-muted-foreground">{fn.staticAnalysisPassed ? 'No forbidden patterns detected' : 'Violations found — see below'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20">
              <span className="text-sm">✓</span>
              <div>
                <p className="text-xs font-medium text-foreground">TypeScript</p>
                <p className="text-xs text-muted-foreground">Compiled without errors</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20">
              <span className="text-sm">✓</span>
              <div>
                <p className="text-xs font-medium text-foreground">Permission Declarations</p>
                <p className="text-xs text-muted-foreground">Declared permissions match implementation</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reasoning' && (
          <div className="p-4 space-y-4 text-xs text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">Why this function exists</p>
              <p>The UI ContactsListPage calls <code className="font-mono bg-muted px-1 rounded">platform.functions.updateContactScore()</code> when a score is edited. Auto-generated CRUD doesn't handle the downstream notification logic — a custom function is required.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Implementation decisions</p>
              <ul className="space-y-1 list-disc pl-4">
                <li>Reads the contact first to capture the previous score for the notification threshold check</li>
                <li>Notification is dispatched via sdk.functions to keep the notification logic decoupled</li>
                <li>Zod validation before any SDK calls prevents invalid data reaching the database</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
