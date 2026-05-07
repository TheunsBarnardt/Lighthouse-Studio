'use client';

import type { BriefDraft, BriefFieldStatus } from '@platform/core';

import { FileText, Edit3, Send, CheckCircle } from 'lucide-react';

import { BriefFieldCard } from '../components/BriefFieldCard';

interface BriefPreviewPanelProps {
  briefDraft: BriefDraft | null;
  briefId: string | null;
  workspaceId: string;
  onGenerateBrief: () => void;
  onSubmitForApproval: () => void;
}

function getFieldStatus(draft: BriefDraft, field: string): BriefFieldStatus {
  return draft.fieldStates[field]?.status ?? 'empty';
}

function getFieldExcerpts(draft: BriefDraft, field: string): string[] {
  return draft.fieldStates[field]?.sourceExcerpts ?? [];
}

export function BriefPreviewPanel({
  briefDraft,
  briefId,
  onGenerateBrief,
  onSubmitForApproval,
}: BriefPreviewPanelProps) {
  const completeness = briefDraft?.completenessPercent ?? 0;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Brief Preview
            </h2>
          </div>
          {briefDraft?.readyToGenerate && !briefId && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle className="w-3 h-3" />
              Ready
            </span>
          )}
        </div>

        {/* Completeness bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Completeness</span>
            <span>{String(completeness)}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${String(completeness)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!briefDraft ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-600">
            <p className="text-xs">Brief fields will appear here as the conversation progresses</p>
          </div>
        ) : (
          <>
            {briefDraft.title && (
              <BriefFieldCard
                label="Title"
                status={getFieldStatus(briefDraft, 'title')}
                sourceExcerpts={getFieldExcerpts(briefDraft, 'title')}
              >
                <p className="font-medium">{briefDraft.title}</p>
              </BriefFieldCard>
            )}

            {briefDraft.summary && (
              <BriefFieldCard
                label="Summary"
                status={getFieldStatus(briefDraft, 'summary')}
                sourceExcerpts={getFieldExcerpts(briefDraft, 'summary')}
              >
                <p>{briefDraft.summary}</p>
              </BriefFieldCard>
            )}

            <BriefFieldCard
              label="Goals"
              status={briefDraft.goals.length > 0 ? getFieldStatus(briefDraft, 'goals') : 'empty'}
              sourceExcerpts={getFieldExcerpts(briefDraft, 'goals')}
            >
              {briefDraft.goals.length === 0 ? (
                <p className="text-gray-400 italic text-xs">Not yet captured</p>
              ) : (
                <ul className="space-y-1">
                  {briefDraft.goals.map((g) => (
                    <li key={g.id} className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 text-xs px-1 rounded ${g.priority === 'must_have' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : g.priority === 'should_have' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
                      >
                        {g.priority === 'must_have'
                          ? 'Must'
                          : g.priority === 'should_have'
                            ? 'Should'
                            : 'Nice'}
                      </span>
                      <span>{g.description}</span>
                    </li>
                  ))}
                </ul>
              )}
            </BriefFieldCard>

            <BriefFieldCard
              label="Target Users"
              status={
                briefDraft.targetUsers.length > 0
                  ? getFieldStatus(briefDraft, 'targetUsers')
                  : 'empty'
              }
              sourceExcerpts={getFieldExcerpts(briefDraft, 'targetUsers')}
            >
              {briefDraft.targetUsers.length === 0 ? (
                <p className="text-gray-400 italic text-xs">Not yet captured</p>
              ) : (
                <ul className="space-y-1">
                  {briefDraft.targetUsers.map((u) => (
                    <li key={u.id}>
                      <span className="font-medium">{u.persona}</span>
                      {u.description && (
                        <span className="text-gray-500 text-xs"> — {u.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </BriefFieldCard>

            {briefDraft.inScope.length > 0 && (
              <BriefFieldCard
                label="In Scope"
                status={getFieldStatus(briefDraft, 'inScope')}
                sourceExcerpts={getFieldExcerpts(briefDraft, 'inScope')}
              >
                <ul className="list-disc list-inside space-y-0.5">
                  {briefDraft.inScope.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </BriefFieldCard>
            )}

            {briefDraft.outOfScope.length > 0 && (
              <BriefFieldCard
                label="Out of Scope"
                status={getFieldStatus(briefDraft, 'outOfScope')}
                sourceExcerpts={getFieldExcerpts(briefDraft, 'outOfScope')}
              >
                <ul className="list-disc list-inside space-y-0.5">
                  {briefDraft.outOfScope.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </BriefFieldCard>
            )}

            {briefDraft.risks.length > 0 && (
              <BriefFieldCard
                label="Risks"
                status={getFieldStatus(briefDraft, 'risks')}
                sourceExcerpts={getFieldExcerpts(briefDraft, 'risks')}
              >
                <ul className="space-y-1">
                  {briefDraft.risks.map((r) => (
                    <li key={r.id} className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${r.likelihood === 'high' ? 'bg-red-500' : r.likelihood === 'medium' ? 'bg-yellow-500' : 'bg-gray-400'}`}
                      />
                      <span>{r.description}</span>
                    </li>
                  ))}
                </ul>
              </BriefFieldCard>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {!briefId ? (
          <button
            onClick={onGenerateBrief}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            Generate Brief
          </button>
        ) : (
          <>
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mb-1">
              <CheckCircle className="w-3 h-3" />
              Brief generated
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.open(`/ai-pipeline/briefs/${briefId}`, '_blank')}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Edit3 className="w-3 h-3" />
                Edit
              </button>
              <button
                onClick={onSubmitForApproval}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-white bg-green-600 hover:bg-green-700 rounded"
              >
                <Send className="w-3 h-3" />
                Submit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
