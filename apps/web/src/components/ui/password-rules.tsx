'use client';

import { CheckCircle2, XCircle } from 'lucide-react';

interface Rule {
  label: string;
  test: (v: string) => boolean;
}

const RULES: Rule[] = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'Uppercase letter (A–Z)', test: (v) => /[A-Z]/.test(v) },
  { label: 'Lowercase letter (a–z)', test: (v) => /[a-z]/.test(v) },
  { label: 'Number (0–9)', test: (v) => /[0-9]/.test(v) },
  { label: 'Special character (!@#…)', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

interface PasswordRulesProps {
  value: string;
}

export function PasswordRules({ value }: PasswordRulesProps) {
  if (!value) return null;

  return (
    <ul className="space-y-1 text-xs">
      {RULES.map((rule) => {
        const passing = rule.test(value);
        return (
          <li
            key={rule.label}
            className={`flex items-center gap-1.5 ${passing ? 'text-green-600' : 'text-destructive'}`}
          >
            {passing ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 shrink-0" />
            )}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
