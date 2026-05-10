'use client';

import type { HTMLAttributes, ImgHTMLAttributes } from 'react';

import { createContext, forwardRef, useContext, useState } from 'react';

import { cn } from '@/lib/utils';

type AvatarStatus = 'loading' | 'loaded' | 'error';

interface AvatarContextValue {
  status: AvatarStatus;
  setStatus: (s: AvatarStatus) => void;
}

const AvatarContext = createContext<AvatarContextValue>({
  status: 'loading',
  setStatus: () => {},
});

export const Avatar = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => {
    const [status, setStatus] = useState<AvatarStatus>('loading');
    return (
      <AvatarContext.Provider value={{ status, setStatus }}>
        <span
          ref={ref}
          className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
          {...props}
        />
      </AvatarContext.Provider>
    );
  },
);
Avatar.displayName = 'Avatar';

export const AvatarImage = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(
  ({ className, onLoad, onError, ...props }, ref) => {
    const { status, setStatus } = useContext(AvatarContext);
    if (status === 'error') return null;
    return (
      <img
        ref={ref}
        className={cn('aspect-square h-full w-full', status !== 'loaded' && 'invisible', className)}
        onLoad={(e) => {
          setStatus('loaded');
          onLoad?.(e);
        }}
        onError={(e) => {
          setStatus('error');
          onError?.(e);
        }}
        {...props}
      />
    );
  },
);
AvatarImage.displayName = 'AvatarImage';

export const AvatarFallback = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => {
    const { status } = useContext(AvatarContext);
    if (status === 'loaded') return null;
    return (
      <span
        ref={ref}
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium',
          className,
        )}
        {...props}
      />
    );
  },
);
AvatarFallback.displayName = 'AvatarFallback';
