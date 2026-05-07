'use client';

import { ChevronDown, ChevronRight, Bot, User } from 'lucide-react';
import { useState } from 'react';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  turnNumber: number;
  costUsd?: number;
  isStreaming?: boolean;
}

export function MessageBubble({
  role,
  content,
  reasoning,
  turnNumber,
  costUsd,
  isStreaming,
}: MessageBubbleProps) {
  const [showReasoning, setShowReasoning] = useState(false);
  const isUser = role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mt-1">
          <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
          }`}
        >
          <p className="whitespace-pre-wrap">{content}</p>
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-current opacity-70 animate-pulse ml-0.5" />
          )}
        </div>

        {reasoning && (
          <button
            onClick={() => {
              setShowReasoning(!showReasoning);
            }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showReasoning ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            Reasoning
          </button>
        )}
        {reasoning && showReasoning && (
          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 max-w-sm">
            {reasoning}
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-300 dark:text-gray-600">T{turnNumber}</span>
          {costUsd !== undefined && costUsd > 0 && (
            <span className="text-xs text-gray-300 dark:text-gray-600">${costUsd.toFixed(4)}</span>
          )}
        </div>
      </div>

      {isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mt-1">
          <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </div>
      )}
    </div>
  );
}
