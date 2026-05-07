'use client';

import type { BriefDraft, IntentBrief } from '@platform/core';

import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { GenerateBriefDialog } from './dialogs/GenerateBriefDialog';
import { SubmitForApprovalDialog } from './dialogs/SubmitForApprovalDialog';
import { BriefPreviewPanel } from './panels/BriefPreviewPanel';
import { ChatPanel } from './panels/ChatPanel';

type DialogState = 'generate' | 'submit' | null;

// eslint-disable-next-line no-restricted-syntax -- client-side
const WORKSPACE_ID = process.env['NEXT_PUBLIC_DEFAULT_WORKSPACE_ID'] ?? 'default';

export default function IntentCaptureConversationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const conversationId = params['conversationId'] as string;
  const activeTab = (searchParams.get('tab') ?? 'chat') as 'chat' | 'brief';

  const [dialog, setDialog] = useState<DialogState>(null);
  const [briefDraft, setBriefDraft] = useState<BriefDraft | null>(null);
  const [generatedBriefId, setGeneratedBriefId] = useState<string | null>(null);
  const [generatedBrief, setGeneratedBrief] = useState<IntentBrief | null>(null);

  function handleReadyToGenerate() {
    setDialog('generate');
  }

  async function handleGenerateBrief() {
    setDialog(null);
    try {
      const res = await fetch(
        `/api/v1/ai/intent-capture/conversations/${conversationId}/brief?workspaceId=${WORKSPACE_ID}`,
        { method: 'POST' },
      );
      if (res.ok) {
        const data = (await res.json()) as { id: string; content?: IntentBrief };
        setGeneratedBriefId(data.id);
        if (data.content) setGeneratedBrief(data.content);
      }
    } catch {
      // error handled by UI
    }
  }

  async function handleSubmitForApproval() {
    if (!generatedBriefId) return;
    setDialog(null);
    await fetch(
      `/api/v1/ai/intent-capture/briefs/${generatedBriefId}/submit?workspaceId=${WORKSPACE_ID}`,
      { method: 'POST' },
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Mobile tab switcher */}
      <div className="md:hidden absolute top-16 left-0 right-0 z-10 flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <a
          href={`?tab=chat`}
          className={`flex-1 py-2 text-sm text-center font-medium ${activeTab === 'chat' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          Chat
        </a>
        <a
          href={`?tab=brief`}
          className={`flex-1 py-2 text-sm text-center font-medium ${activeTab === 'brief' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          Brief Preview
        </a>
      </div>

      {/* Chat Panel */}
      <div className={`flex-1 ${activeTab === 'brief' ? 'hidden md:flex' : 'flex'} flex-col`}>
        <ChatPanel
          conversationId={conversationId}
          workspaceId={WORKSPACE_ID}
          onBriefUpdate={setBriefDraft}
          onReadyToGenerate={handleReadyToGenerate}
        />
      </div>

      {/* Brief Preview Panel */}
      <div
        className={`${activeTab === 'chat' ? 'hidden md:flex' : 'flex'} w-full md:w-96 shrink-0 flex-col border-l border-gray-200 dark:border-gray-700`}
      >
        <BriefPreviewPanel
          briefDraft={briefDraft}
          briefId={generatedBriefId}
          brief={generatedBrief}
          workspaceId={WORKSPACE_ID}
          onGenerateBrief={handleReadyToGenerate}
          onSubmitForApproval={() => {
            setDialog('submit');
          }}
          onBriefUpdate={(updates) => {
            if (generatedBrief) {
              setGeneratedBrief({ ...generatedBrief, ...updates });
            }
          }}
        />
      </div>

      {/* Dialogs */}
      {dialog === 'generate' && (
        <GenerateBriefDialog
          briefDraft={briefDraft}
          onConfirm={() => {
            void handleGenerateBrief();
          }}
          onCancel={() => {
            setDialog(null);
          }}
        />
      )}
      {dialog === 'submit' && (
        <SubmitForApprovalDialog
          onConfirm={() => {
            void handleSubmitForApproval();
          }}
          onCancel={() => {
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
