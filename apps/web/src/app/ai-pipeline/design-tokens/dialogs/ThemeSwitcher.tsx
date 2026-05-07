'use client';

import { Sun, Moon } from 'lucide-react';

interface ThemeSwitcherProps {
  theme: 'light' | 'dark';
  onChange: (theme: 'light' | 'dark') => void;
}

export function ThemeSwitcher({ theme, onChange }: ThemeSwitcherProps) {
  return (
    <div className="flex items-center rounded-md border border-gray-300 overflow-hidden">
      <button
        onClick={() => onChange('light')}
        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
          theme === 'light' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
        }`}
      >
        <Sun className="w-3.5 h-3.5" /> Light
      </button>
      <button
        onClick={() => onChange('dark')}
        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
          theme === 'dark' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
        }`}
      >
        <Moon className="w-3.5 h-3.5" /> Dark
      </button>
    </div>
  );
}
