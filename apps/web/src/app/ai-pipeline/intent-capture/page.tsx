'use client';

import { useQuery } from '@tanstack/react-query';
import { MessageSquarePlus, Clock, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { TemplatesDialog } from './[conversationId]/dialogs/TemplatesDialog';

// eslint-disable-next-line no-restricted-syntax -- client-side
const WORKSPACE_ID = process.env['NEXT_PUBLIC_DEFAULT_WORKSPACE_ID'] ?? 'default';

interface ConversationItem {
  id: string;
  type: string;
  status: string;
  _createdAt: string;
  _updatedAt: string;
  content: {
    turnCount?: number;
    totalCostUsd?: number;
    briefArtifactId?: string;
  };
}

export default function IntentCapturePage() {
  const router = useRouter();
  const [showTemplates, setShowTemplates] = useState(false);

  const { data, isLoading } = useQuery<{ items: ConversationItem[]; total: number }>({
    queryKey: ['intent-capture-conversations', WORKSPACE_ID],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/ai/intent-capture/conversations?workspaceId=${WORKSPACE_ID}`,
      );
      if (!res.ok) throw new Error('Failed to load conversations');
      return res.json() as Promise<{ items: ConversationItem[]; total: number }>;
    },
  });

  function handleStartBlank() {
    void fetch('/api/v1/ai/intent-capture/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: WORKSPACE_ID }),
    })
      .then((r) => r.json())
      .then((conv: { id: string }) => {
        router.push(`/ai-pipeline/intent-capture/${conv.id}`);
        return undefined;
      });
  }

  function handleSelectTemplate(templateId: string) {
    void fetch('/api/v1/ai/intent-capture/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: WORKSPACE_ID, templateId }),
    })
      .then((r) => r.json())
      .then((conv: { id: string }) => {
        router.push(`/ai-pipeline/intent-capture/${conv.id}`);
        return undefined;
      });
    setShowTemplates(false);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Intent Capture</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Have a conversation to define your project&apos;s requirements brief
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowTemplates(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <FileText className="w-4 h-4" />
            Use Template
          </button>
          <button
            onClick={handleStartBlank}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            <MessageSquarePlus className="w-4 h-4" />
            New Conversation
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading conversations…</div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <MessageSquarePlus className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No conversations yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-4">
            Start a conversation to capture your project requirements
          </p>
          <button
            onClick={() => {
              setShowTemplates(true);
            }}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Browse templates →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.items.map((conv) => (
            <button
              key={conv.id}
              onClick={() => {
                router.push(`/ai-pipeline/intent-capture/${conv.id}`);
              }}
              className="w-full text-left p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Conversation
                  </span>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(conv._updatedAt).toLocaleDateString()}
                    </span>
                    {conv.content.turnCount !== undefined && (
                      <span className="text-xs text-gray-500">{conv.content.turnCount} turns</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {conv.content.briefArtifactId && (
                    <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                      Brief generated
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    ${(conv.content.totalCostUsd ?? 0).toFixed(3)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showTemplates && (
        <TemplatesDialog
          onSelectTemplate={handleSelectTemplate}
          onStartBlank={handleStartBlank}
          onClose={() => {
            setShowTemplates(false);
          }}
        />
      )}
    </div>
  );
}
