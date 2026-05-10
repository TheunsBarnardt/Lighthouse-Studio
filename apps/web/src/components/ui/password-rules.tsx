'use client';

import { CheckCircle2, XCircle } from 'lucide-react';

interface Rule {
  label: string;
  test: (v: string) => boolean;
}

const RULES: Rule[] = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'Uppercase letter (Aâ€“Z)', test: (v) => /[A-Z]/.test(v) },
  { label: 'Lowercase letter (aâ€“z)', test: (v) => /[a-z]/.test(v) },
  { label: 'Number (0â€“9)', test: (v) => /[0-9]/.test(v) },
  { label: 'Special character (!@#â€¦)', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

interface PasswordRulesProps {
  value: string;
}

export function PasswordRules({ value }: PasswordRulesProps) {
  if (!value) return null;

  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      {RULES.map((rule) => {
        const passing = rule.test(value);
        return (
          <li
            key={rule.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: passing ? 'oklch(0.45 0.15 145)' : 'var(--destructive, #dc2626)',
            }}
          >
            {passing ? (
              <CheckCircle2 style={{ width: 13, height: 13, flexShrink: 0 }} />
            ) : (
              <XCircle style={{ width: 13, height: 13, flexShrink: 0 }} />
            )}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
