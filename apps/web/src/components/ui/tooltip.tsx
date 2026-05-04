'use client';

import type { HTMLAttributes, ReactNode } from 'react';

import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const sideStyles: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => {
        setVisible(true);
      }}
      onMouseLeave={() => {
        setVisible(false);
      }}
      onFocus={() => {
        setVisible(true);
      }}
      onBlur={() => {
        setVisible(false);
      }}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={cn(
            'absolute z-50 max-w-xs rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-md',
            'animate-in fade-in-0 zoom-in-95',
            sideStyles[side],
            className,
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export type TooltipContentProps = HTMLAttributes<HTMLDivElement>;

export { Tooltip };
