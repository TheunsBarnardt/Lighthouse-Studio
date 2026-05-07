'use client';

import type { BriefDraft, ConversationEvent } from '@platform/core';

import { Send, AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { CostIndicator } from '../components/CostIndicator';
import { MessageBubble } from '../components/MessageBubble';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  turnNumber: number;
  costUsd?: number;
  isStreaming?: boolean;
}

interface ChatPanelProps {
  conversationId: string;
  workspaceId: string;
  onBriefUpdate: (draft: BriefDraft) => void;
  onReadyToGenerate: () => void;
}

const MAX_TURNS = 25;

export function ChatPanel({
  conversationId,
  workspaceId,
  onBriefUpdate,
  onReadyToGenerate,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [totalCostUsd, setTotalCostUsd] = useState(0);
  const [lastTurnCostUsd, setLastTurnCostUsd] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const newTurnNumber = turnCount + 1;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      turnNumber: newTurnNumber,
    };

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      turnNumber: newTurnNumber,
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);
    setTurnCount(newTurnNumber);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch(
        `/api/v1/ai/intent-capture/conversations/${conversationId}/messages?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed }),
          signal: abort.signal,
        },
      );

      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let assistantContent = '';
      let buffer = '';

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data) as ConversationEvent;

            if (event.type === 'text_delta') {
              assistantContent += event.delta;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: assistantContent } : m,
                ),
              );
            } else if (event.type === 'brief_update') {
              // brief updates handled in turn_complete
            } else if (event.type === 'cost_update') {
              setLastTurnCostUsd(event.costUsd);
              setTotalCostUsd(event.totalCostUsd);
            } else if (event.type === 'ready_to_generate' && event.readyToGenerate) {
              onReadyToGenerate();
            } else if (event.type === 'turn_complete') {
              onBriefUpdate(event.briefDraft);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? ({
                        ...m,
                        content: event.message.content,
                        isStreaming: false,
                        ...(event.message.costUsd !== undefined && {
                          costUsd: event.message.costUsd,
                        }),
                      } as Message)
                    : m,
                ),
              );
            } else if (event.type === 'turn_limit_reached') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? {
                        ...m,
                        content: `Maximum ${String(MAX_TURNS)} turns reached. Please generate your brief.`,
                        isStreaming: false,
                      }
                    : m,
                ),
              );
            } else if (event.type === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: `Error: ${event.message}`, isStreaming: false }
                    : m,
                ),
              );
            }
          } catch {
            // skip malformed SSE
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: 'Failed to send message. Please try again.', isStreaming: false }
              : m,
          ),
        );
      }
    } finally {
      setIsStreaming(false);
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, isStreaming: false } : m)),
      );
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  const nearingLimit = turnCount >= MAX_TURNS - 3;

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-600">
            <p className="text-sm">Start describing what you want to build</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            turnNumber={msg.turnNumber}
            {...(msg.costUsd !== undefined && { costUsd: msg.costUsd })}
            {...(msg.isStreaming !== undefined && { isStreaming: msg.isStreaming })}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Turn limit warning */}
      {nearingLimit && turnCount < MAX_TURNS && (
        <div className="mx-4 mb-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
          <p className="text-xs text-yellow-700 dark:text-yellow-400">
            {MAX_TURNS - turnCount} turns remaining — consider generating your brief soon
          </p>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              turnCount >= MAX_TURNS ? 'Conversation limit reached' : 'Describe your project…'
            }
            disabled={isStreaming || turnCount >= MAX_TURNS}
            rows={3}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={() => {
              void sendMessage();
            }}
            disabled={!input.trim() || isStreaming || turnCount >= MAX_TURNS}
            className="self-end px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">
            {turnCount}/{MAX_TURNS} turns
          </span>
          <CostIndicator totalCostUsd={totalCostUsd} lastTurnCostUsd={lastTurnCostUsd} />
        </div>
      </div>
    </div>
  );
}
