import type { SelectHTMLAttributes } from 'react';

import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        aria-invalid={error}
        className={cn(
          'flex h-9 w-full appearance-none rounded-md border bg-background px-3 py-1 pr-8 text-sm shadow-xs',
          'cursor-pointer',
          'transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-error focus-visible:ring-error' : 'border-input',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = 'Select';

export { Select };
