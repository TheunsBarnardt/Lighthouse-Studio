'use client';

import type { IntentBrief } from '@platform/core';

import { AlertTriangle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Markdown serialisation ────────────────────────────────────────────────────

function briefToMarkdown(brief: IntentBrief): string {
  const lines: string[] = [];

  lines.push(`# ${brief.title || 'Untitled Brief'}`, '');

  if (brief.summary) {
    lines.push(brief.summary, '');
  }

  // Goals
  lines.push('## Goals', '');
  if (brief.goals.length === 0) {
    lines.push('_No goals captured yet._', '');
  } else {
    for (const g of brief.goals) {
      const priority =
        g.priority === 'must_have' ? 'Must' : g.priority === 'should_have' ? 'Should' : 'Nice';
      lines.push(`- [${priority}] ${g.description}`);
      if (g.acceptanceCriteria.length > 0) {
        for (const ac of g.acceptanceCriteria) {
          lines.push(`  - ${ac}`);
        }
      }
    }
    lines.push('');
  }

  // Target Users
  lines.push('## Target Users', '');
  if (brief.targetUsers.length === 0) {
    lines.push('_No target users captured yet._', '');
  } else {
    for (const u of brief.targetUsers) {
      lines.push(`### ${u.persona}`);
      if (u.description) lines.push(u.description);
      if (u.needs.length > 0) {
        lines.push('**Needs:**');
        for (const n of u.needs) lines.push(`- ${n}`);
      }
      if (u.painPoints.length > 0) {
        lines.push('**Pain points:**');
        for (const p of u.painPoints) lines.push(`- ${p}`);
      }
      lines.push('');
    }
  }

  // Success Criteria
  lines.push('## Success Criteria', '');
  if (brief.successCriteria.length === 0) {
    lines.push('_No success criteria captured yet._', '');
  } else {
    for (const sc of brief.successCriteria) {
      const metric = sc.metric ? ` *(${sc.metric}${sc.target ? ` → ${sc.target}` : ''})*` : '';
      lines.push(`- ${sc.description}${metric}`);
    }
    lines.push('');
  }

  // In Scope
  lines.push('## In Scope', '');
  if (brief.inScope.length === 0) {
    lines.push('_Not yet defined._', '');
  } else {
    for (const item of brief.inScope) lines.push(`- ${item}`);
    lines.push('');
  }

  // Out of Scope
  lines.push('## Out of Scope', '');
  if (brief.outOfScope.length === 0) {
    lines.push('_Not yet defined._', '');
  } else {
    for (const item of brief.outOfScope) lines.push(`- ${item}`);
    lines.push('');
  }

  // Constraints
  if (brief.constraints.length > 0) {
    lines.push('## Constraints', '');
    for (const c of brief.constraints) {
      const hardness = c.severity === 'hard' ? 'Hard' : 'Soft';
      lines.push(`- [${hardness}/${c.type}] ${c.description}`);
    }
    lines.push('');
  }

  // Assumptions
  if (brief.assumptions.length > 0) {
    lines.push('## Assumptions', '');
    for (const a of brief.assumptions) {
      lines.push(`- [Risk if wrong: ${a.impact}] ${a.description}`);
    }
    lines.push('');
  }

  // Risks
  if (brief.risks.length > 0) {
    lines.push('## Risks', '');
    for (const r of brief.risks) {
      const mitigation = r.mitigationIdea ? ` *Mitigation: ${r.mitigationIdea}*` : '';
      lines.push(`- [${r.likelihood}/${r.impact}] ${r.description}${mitigation}`);
    }
    lines.push('');
  }

  if (brief.estimatedScope) {
    lines.push(`## Estimated Scope`, '', `${brief.estimatedScope}`, '');
  }

  return lines.join('\n').trimEnd();
}

// ── Markdown parsing (best-effort, line-by-line) ──────────────────────────────

function parseTitleLine(line: string): string | null {
  const m = /^#\s+(.+)/.exec(line);
  return m ? (m[1] ?? '') : null;
}

function parseMarkdownToPartialBrief(md: string): Partial<IntentBrief> {
  const lines = md.split('\n');
  const updates: Partial<IntentBrief> = {};

  let currentSection: string | null = null;
  const summaryLines: string[] = [];
  const inScope: string[] = [];
  const outOfScope: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // H1 = title
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      const t = parseTitleLine(trimmed);
      if (t && t !== 'Untitled Brief') updates.title = t;
      currentSection = null;
      continue;
    }

    // H2 = section boundary
    if (trimmed.startsWith('## ')) {
      const sectionName = trimmed.replace(/^##\s+/, '').toLowerCase().replace(/\s+/g, '_');
      currentSection = sectionName;
      continue;
    }

    // H3 inside goals/users/etc — skip for simple parsing
    if (trimmed.startsWith('### ')) continue;

    // Collect summary text (everything before the Goals section that isn't a heading)
    if (!currentSection && !trimmed.startsWith('#') && trimmed.length > 0) {
      summaryLines.push(trimmed);
      continue;
    }

    if (currentSection === 'in_scope' && trimmed.startsWith('- ')) {
      const item = trimmed.slice(2).trim();
      if (item && !item.startsWith('_')) inScope.push(item);
    }

    if (currentSection === 'out_of_scope' && trimmed.startsWith('- ')) {
      const item = trimmed.slice(2).trim();
      if (item && !item.startsWith('_')) outOfScope.push(item);
    }
  }

  if (summaryLines.length > 0) updates.summary = summaryLines.join(' ');
  if (inScope.length > 0) updates.inScope = inScope;
  if (outOfScope.length > 0) updates.outOfScope = outOfScope;

  return updates;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MarkdownBriefViewProps {
  brief: IntentBrief;
  onUpdate: (updates: Partial<IntentBrief>) => void;
}

export function MarkdownBriefView({ brief, onUpdate }: MarkdownBriefViewProps) {
  const [markdown, setMarkdown] = useState(() => briefToMarkdown(brief));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync when brief changes externally (e.g. from structured view edits)
  useEffect(() => {
    setMarkdown(briefToMarkdown(brief));
  }, [brief]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newMd = e.target.value;
      setMarkdown(newMd);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const updates = parseMarkdownToPartialBrief(newMd);
        if (Object.keys(updates).length > 0) {
          onUpdate(updates);
        }
      }, 500);
    },
    [onUpdate],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Warning banner */}
      <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 text-xs text-yellow-800 dark:text-yellow-300 shrink-0">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>
          Markdown editing is experimental. Only title, summary, in-scope, and out-of-scope are
          parsed back to the structured view. Complex fields (goals, users, risks) should be edited
          in the Structured view.
        </span>
      </div>

      {/* Textarea */}
      <textarea
        value={markdown}
        onChange={handleChange}
        spellCheck={false}
        className="flex-1 w-full p-4 font-mono text-sm resize-none focus:outline-none bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 leading-relaxed"
        aria-label="Intent brief markdown editor"
        placeholder="# Brief title&#10;&#10;Write your brief in markdown…"
      />
    </div>
  );
}
