'use client';

import { useEffect, useRef, useState } from 'react';

interface SearchPanelProps {
  value: string;
  onChange: (query: string) => void;
  placeholder?: string;
}

export function SearchPanel({ value, onChange, placeholder = 'Search files…' }: SearchPanelProps) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = (v: string) => {
    setLocal(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(v);
    }, 300);
  };

  return (
    <div className="relative flex items-center">
      <svg
        className="absolute left-2.5 h-4 w-4 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="search"
        aria-label="Search files"
        value={local}
        onChange={(e) => {
          handleChange(e.target.value);
        }}
        placeholder={placeholder}
        className="w-64 rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
      />
      {local && (
        <button
          onClick={() => {
            handleChange('');
          }}
          aria-label="Clear search"
          className="absolute right-2 text-muted-foreground hover:text-foreground"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
