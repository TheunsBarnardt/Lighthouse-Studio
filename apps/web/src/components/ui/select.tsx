import type { CSSProperties, SelectHTMLAttributes } from 'react';

import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

const base: CSSProperties = {
  display: 'flex',
  height: 36,
  width: '100%',
  appearance: 'none',
  borderRadius: 'var(--shell-radius-sm)',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-input)',
  color: 'var(--fg-primary)',
  fontSize: 13,
  padding: '0 28px 0 10px',
  outline: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'border-color 100ms, box-shadow 100ms',
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, style, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        aria-invalid={error}
        className={cn(
          'focus:border-[--border-focus] focus:shadow-[0_0_0_3px_oklch(0.50_0.20_250_/_0.15)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-[--fg-danger]',
          className,
        )}
        style={{ ...base, ...style }}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = 'Select';

export { Select };
