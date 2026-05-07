'use client';

import { useState, useRef } from 'react';
import { Search } from 'lucide-react';
import type { DocNavItem } from '../page';

function flattenNav(items: DocNavItem[]): DocNavItem[] {
  return items.flatMap(item => [item, ...(item.children ? flattenNav(item.children) : [])]);
}

interface Props {
  navItems: DocNavItem[];
  onNavigate: (item: DocNavItem) => void;
}

export function DocSearch({ navItems, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const allPages = flattenNav(navItems);
  const results = query.trim().length > 0
    ? allPages.filter(p => p.title.toLowerCase().includes(query.toLowerCase()))
    : [];

  const handleSelect = (item: DocNavItem) => {
    onNavigate(item);
    setQuery('');
    setFocused(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative flex-1 max-w-sm">
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search docs…"
          className="bg-transparent text-sm flex-1 outline-none placeholder:text-muted-foreground"
        />
      </div>

      {focused && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-background border rounded-md shadow-lg overflow-hidden">
          {results.map(item => (
            <button
              key={item.id}
              onMouseDown={() => handleSelect(item)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
            >
              {item.title}
              <span className="text-xs text-muted-foreground ml-2">{item.slug}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
