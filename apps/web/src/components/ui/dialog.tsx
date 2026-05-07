'use client';

import type { ReactNode } from 'react';

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-5xl',
} as const;

function Dialog({
  open,
  onClose,
  onOpenChange,
  title,
  description,
  children,
  className,
  size = 'md',
}: DialogProps) {
  const handleClose = () => {
    onClose?.();
    onOpenChange?.(false);
  };
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    if (open) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'dialog-title' : undefined}
      aria-describedby={description ? 'dialog-description' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
      <div
        className={cn(
          'relative z-50 w-full rounded-xl border bg-card shadow-xl',
          sizes[size],
          className,
        )}
      >
        {(title ?? description) && (
          <div className="border-b px-6 py-4">
            {title && (
              <h2 id="dialog-title" className="text-lg font-semibold">
                {title}
              </h2>
            )}
            {description && (
              <p id="dialog-description" className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export interface DialogFooterProps {
  children: ReactNode;
  className?: string;
}

function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div className={cn('flex justify-end gap-3 border-t px-6 py-4 -mx-6 -mb-6 mt-6', className)}>
      {children}
    </div>
  );
}

// shadcn/ui-compatible sub-components
function DialogContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-6', className)}>{children}</div>;
}

function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col space-y-1.5 mb-4', className)}>{children}</div>;
}

function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)}>{children}</h2>;
}

function DialogDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>;
}

function DialogTrigger({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function DialogClose({ children, className }: { children?: ReactNode; className?: string }) {
  return <button type="button" className={cn('', className)}>{children}</button>;
}

export { Dialog, DialogFooter, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose };
