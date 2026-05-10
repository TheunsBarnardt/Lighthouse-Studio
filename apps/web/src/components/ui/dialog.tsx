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
      {/* Overlay */}
      <div className="absolute inset-0" style={{ background: 'var(--bg-overlay)' }} aria-hidden="true" />

      {/* Panel */}
      <div
        className={cn('relative z-50 w-full rounded-xl shadow-xl', sizes[size], className)}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          color: 'var(--fg-primary)',
        }}
      >
        {(title ?? description) && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-default)' }}>
            {title && (
              <h2
                id="dialog-title"
                style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--fg-primary)' }}
              >
                {title}
              </h2>
            )}
            {description && (
              <p
                id="dialog-description"
                style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-secondary)' }}
              >
                {description}
              </p>
            )}
          </div>
        )}
        <div style={{ padding: 24 }}>{children}</div>
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
    <div
      className={cn('flex justify-end gap-3', className)}
      style={{
        marginTop: 24,
        paddingTop: 16,
        borderTop: '1px solid var(--border-default)',
      }}
    >
      {children}
    </div>
  );
}

function DialogContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('', className)}>{children}</div>;
}

function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col space-y-1.5 mb-4', className)}>{children}</div>;
}

function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cn('text-base font-semibold leading-none', className)}
      style={{ color: 'var(--fg-primary)' }}
    >
      {children}
    </h2>
  );
}

function DialogDescription({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-sm', className)} style={{ color: 'var(--fg-secondary)' }}>
      {children}
    </p>
  );
}

function DialogTrigger({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function DialogClose({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <button type="button" className={cn('', className)}>
      {children}
    </button>
  );
}

export {
  Dialog,
  DialogFooter,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
};
