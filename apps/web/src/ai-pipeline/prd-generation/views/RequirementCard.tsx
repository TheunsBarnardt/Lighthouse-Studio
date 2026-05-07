'use client';

import type { FunctionalRequirement } from '@platform/core';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const PRIORITY_BADGE: Record<FunctionalRequirement['priority'], string> = {
  must: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  should: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  could: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  wont: 'bg-muted text-muted-foreground',
};

interface RequirementCardProps {
  requirement: FunctionalRequirement;
  editable: boolean;
  onChange?: (r: FunctionalRequirement) => void;
}

export function RequirementCard({ requirement, editable, onChange }: RequirementCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);

  const handleTitleChange = (value: string) => {
    onChange?.({ ...requirement, title: value });
  };

  const handleDescChange = (value: string) => {
    onChange?.({ ...requirement, description: value });
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
          {requirement.id}
        </span>

        <div className="flex-1 min-w-0">
          {editable && editingTitle ? (
            <input
              autoFocus
              className="w-full rounded border bg-background px-2 py-0.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              value={requirement.title}
              onChange={(e) => {
                handleTitleChange(e.target.value);
              }}
              onBlur={() => {
                setEditingTitle(false);
              }}
              aria-label="Requirement title"
            />
          ) : (
            <p
              className={`text-sm font-medium ${editable ? 'cursor-pointer hover:underline' : ''}`}
              onClick={() => {
                if (editable) setEditingTitle(true);
              }}
            >
              {requirement.title}
            </p>
          )}
        </div>

        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_BADGE[requirement.priority]}`}
        >
          {requirement.priority}
        </span>
      </div>

      {/* Description */}
      {editable && editingDesc ? (
        <textarea
          autoFocus
          className="w-full rounded border bg-background px-2 py-1.5 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          rows={3}
          value={requirement.description}
          onChange={(e) => {
            handleDescChange(e.target.value);
          }}
          onBlur={() => {
            setEditingDesc(false);
          }}
          aria-label="Requirement description"
        />
      ) : (
        <p
          className={`text-sm text-muted-foreground ${editable ? 'cursor-pointer hover:text-foreground' : ''}`}
          onClick={() => {
            if (editable) setEditingDesc(true);
          }}
        >
          {requirement.description}
        </p>
      )}

      {/* Acceptance criteria toggle */}
      {requirement.acceptanceCriteria.length > 0 && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setExpanded((v) => !v);
            }}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            )}
            {requirement.acceptanceCriteria.length} acceptance{' '}
            {requirement.acceptanceCriteria.length === 1 ? 'criterion' : 'criteria'}
          </button>

          {expanded && (
            <div className="mt-2 space-y-2">
              {requirement.acceptanceCriteria.map((ac) => (
                <div
                  key={ac.id}
                  className="rounded bg-muted/50 p-3 font-mono text-xs space-y-1"
                  role="region"
                  aria-label={`Acceptance criterion ${ac.id}`}
                >
                  <p>
                    <span className="text-muted-foreground">Given</span>{' '}
                    <span className="text-foreground">{ac.given}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">When</span>{' '}
                    <span className="text-foreground">{ac.when}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Then</span>{' '}
                    <span className="text-foreground">{ac.then}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Related stories */}
      {requirement.relatedStories && requirement.relatedStories.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {requirement.relatedStories.map((storyId) => (
            <span
              key={storyId}
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
            >
              {storyId}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
