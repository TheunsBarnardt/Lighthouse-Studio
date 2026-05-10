import type { CSSProperties, InputHTMLAttributes } from 'react';

import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const base: CSSProperties = {
  display: 'flex',
  width: '100%',
  height: 36,
  borderRadius: 'var(--shell-radius-sm)',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-input)',
  color: 'var(--fg-primary)',
  fontSize: 13,
  padding: '0 10px',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 100ms, box-shadow 100ms',
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, style, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        aria-invalid={error}
        className={cn(
          'placeholder:text-[--fg-tertiary]',
          'focus:border-[--border-focus] focus:shadow-[0_0_0_3px_oklch(0.50_0.20_250_/_0.15)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-[--fg-danger] focus:border-[--fg-danger] focus:shadow-[0_0_0_3px_oklch(0.45_0.18_25_/_0.15)]',
          className,
        )}
        style={{ ...base, ...style }}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
