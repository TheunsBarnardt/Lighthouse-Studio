import type { ButtonHTMLAttributes } from 'react';

import { Slot } from '@radix-ui/react-slot';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary',
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-secondary/90 focus-visible:ring-secondary',
  destructive:
    'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive',
  outline:
    'border border-border bg-background hover:bg-muted text-foreground focus-visible:ring-ring',
  ghost: 'hover:bg-muted text-foreground focus-visible:ring-ring',
  link: 'text-primary underline-offset-4 hover:underline focus-visible:ring-primary',
} as const;

const sizes = {
  xs: 'h-6 px-2 text-[11px] rounded',
  sm: 'h-8 px-3 text-xs rounded-md',
  md: 'h-9 px-4 text-sm rounded-md',
  lg: 'h-10 px-6 text-base rounded-lg',
  icon: 'h-9 w-9 rounded-md',
} as const;

const BASE =
  'inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap';

export interface ButtonVariantsProps {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

/** Generates button class string — use this when you need Link-as-button. */
export function buttonVariants({ variant = 'primary', size = 'md' }: ButtonVariantsProps = {}) {
  return cn(BASE, variants[variant], sizes[size]);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantsProps {
  /** Render the button's children as a child element (e.g. Link) via Radix Slot. */
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        disabled={disabled}
        aria-disabled={disabled}
        className={cn(BASE, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button };
