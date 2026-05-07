'use client';

import type { UserStory } from '@platform/core';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const PRIORITY_BADGE: Record<UserStory['priority'], string> = {
  must: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  should: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  could: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  wont: 'bg-muted text-muted-foreground',
};

interface UserStoryCardProps {
  story: UserStory;
  editable: boolean;
}

export function UserStoryCard({ story, editable }: UserStoryCardProps) {
  const [expanded, setExpanded] = useState(false);

  void editable; // prop reserved for future inline editing

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
          {story.id}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground">{story.formatted}</p>
          {story.storyPoints !== undefined && (
            <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {story.storyPoints} {story.storyPoints === 1 ? 'point' : 'points'}
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_BADGE[story.priority]}`}
          >
            {story.priority}
          </span>
          {story.persona && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {story.persona}
            </span>
          )}
        </div>
      </div>

      {/* Acceptance criteria toggle */}
      {story.acceptanceCriteria.length > 0 && (
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
            {story.acceptanceCriteria.length} acceptance{' '}
            {story.acceptanceCriteria.length === 1 ? 'criterion' : 'criteria'}
          </button>

          {expanded && (
            <div className="mt-2 space-y-2">
              {story.acceptanceCriteria.map((ac) => (
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
    </div>
  );
}
