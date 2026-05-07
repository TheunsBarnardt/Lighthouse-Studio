'use client';

import type { BriefFieldStatus } from '@platform/core';

import { CheckCircle, AlertCircle, Circle } from 'lucide-react';
import { useState } from 'react';

interface BriefFieldCardProps {
  label: string;
  status: BriefFieldStatus;
  children: React.ReactNode;
  sourceExcerpts?: string[];
}

const statusConfig = {
  empty: {
    icon: Circle,
    color: 'border-gray-200 dark:border-gray-700',
    iconColor: 'text-gray-300 dark:text-gray-600',
    badge: null,
  },
  tentative: {
    icon: AlertCircle,
    color: 'border-yellow-200 dark:border-yellow-800',
    iconColor: 'text-yellow-500',
    badge: 'Tentative',
  },
  confident: {
    icon: CheckCircle,
    color: 'border-green-200 dark:border-green-800',
    iconColor: 'text-green-500',
    badge: null,
  },
};

export function BriefFieldCard({ label, status, children, sourceExcerpts }: BriefFieldCardProps) {
  const [showSources, setShowSources] = useState(false);
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`p-3 border rounded-lg ${config.color}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${config.iconColor}`} />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {config.badge && (
            <span className="text-xs px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
              {config.badge}
            </span>
          )}
          {sourceExcerpts && sourceExcerpts.length > 0 && (
            <button
              onClick={() => {
                setShowSources(!showSources);
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {showSources ? 'Hide sources' : 'Sources'}
            </button>
          )}
        </div>
      </div>
      <div className="text-sm text-gray-800 dark:text-gray-200">{children}</div>
      {showSources && sourceExcerpts && sourceExcerpts.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          {sourceExcerpts.map((excerpt, i) => (
            <p key={i} className="text-xs text-gray-400 dark:text-gray-500 italic mt-1">
              &ldquo;{excerpt.substring(0, 120)}
              {excerpt.length > 120 ? '…' : ''}&rdquo;
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
