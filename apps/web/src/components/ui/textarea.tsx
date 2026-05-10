import type { TextareaHTMLAttributes } from 'react';

import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, style, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded border border-border bg-background px-2.5 py-2 text-[13px] text-foreground outline-none font-[inherit] resize-y transition-[border-color,box-shadow] duration-100',
        'placeholder:text-muted-foreground',
        'focus:border-ring focus:shadow-[0_0_0_3px_oklch(0.50_0.20_250_/_0.15)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      style={style}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
