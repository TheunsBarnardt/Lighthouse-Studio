'use client';

import { useState } from 'react';
import { X, Plus, Lock, Unlock } from 'lucide-react';

const VIBE_OPTIONS = [
  'professional', 'playful', 'minimalist', 'bold', 'warm',
  'trustworthy', 'modern', 'classic', 'energetic', 'calm',
  'luxurious', 'approachable', 'technical', 'creative', 'clean',
];

interface BrandColor {
  name: string;
  hex: string;
  locked: boolean;
}

interface BrandInputsPanelProps {
  onGenerate: (inputs: Record<string, unknown>) => Promise<void>;
  isGenerating: boolean;
}

export function BrandInputsPanel({ onGenerate, isGenerating }: BrandInputsPanelProps) {
  const [vibeDescriptors, setVibeDescriptors] = useState<string[]>([]);
  const [brandColors, setBrandColors] = useState<BrandColor[]>([]);
  const [referenceUrls, setReferenceUrls] = useState<string[]>(['']);
  const [newColorHex, setNewColorHex] = useState('#3b82f6');
  const [newColorName, setNewColorName] = useState('');

  const toggleVibe = (vibe: string) => {
    setVibeDescriptors(prev =>
      prev.includes(vibe) ? prev.filter(v => v !== vibe) : [...prev, vibe]
    );
  };

  const addColor = () => {
    if (!newColorName.trim()) return;
    setBrandColors(prev => [...prev, { name: newColorName, hex: newColorHex, locked: false }]);
    setNewColorName('');
    setNewColorHex('#3b82f6');
  };

  const toggleLock = (i: number) => {
    setBrandColors(prev => prev.map((c, idx) => idx === i ? { ...c, locked: !c.locked } : c));
  };

  const removeColor = (i: number) => setBrandColors(prev => prev.filter((_, idx) => idx !== i));

  const addUrl = () => setReferenceUrls(prev => [...prev, '']);
  const updateUrl = (i: number, val: string) => setReferenceUrls(prev => prev.map((u, idx) => idx === i ? val : u));
  const removeUrl = (i: number) => setReferenceUrls(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (vibeDescriptors.length === 0) return;
    await onGenerate({
      vibeDescriptors,
      brandColors: brandColors.length > 0 ? brandColors : undefined,
      referenceUrls: referenceUrls.filter(Boolean).length > 0 ? referenceUrls.filter(Boolean) : undefined,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
      {/* Vibe descriptors */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Vibe descriptors <span className="text-red-500">*</span>
          <span className="text-xs text-gray-400 font-normal ml-1">(choose 3–5)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {VIBE_OPTIONS.map(v => (
            <button
              key={v}
              onClick={() => toggleVibe(v)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                vibeDescriptors.includes(v)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Brand colors */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Brand colors (optional)</label>
        <div className="space-y-2">
          {brandColors.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded border flex-shrink-0" style={{ backgroundColor: c.hex }} />
              <span className="text-sm text-gray-700 flex-1">{c.name} ({c.hex})</span>
              <button onClick={() => toggleLock(i)} className="text-gray-400 hover:text-gray-600">
                {c.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
              <button onClick={() => removeColor(i)} className="text-gray-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {brandColors.length < 3 && (
            <div className="flex items-center gap-2">
              <input type="color" value={newColorHex} onChange={e => setNewColorHex(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-gray-300" />
              <input
                type="text" value={newColorName} onChange={e => setNewColorName(e.target.value)}
                placeholder="Color name (e.g. Brand Blue)"
                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={addColor} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reference URLs */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reference URLs (optional)
          <span className="text-xs text-gray-400 font-normal ml-1">(websites whose feel you like; max 3)</span>
        </label>
        <div className="space-y-2">
          {referenceUrls.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="url" value={url} onChange={e => updateUrl(i, e.target.value)}
                placeholder="https://example.com"
                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={() => removeUrl(i)} className="text-gray-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {referenceUrls.length < 3 && (
            <button onClick={addUrl} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
              <Plus className="w-4 h-4" /> Add URL
            </button>
          )}
        </div>
      </div>

      {/* Generate */}
      <button
        onClick={handleSubmit}
        disabled={vibeDescriptors.length === 0 || isGenerating}
        className="w-full py-3 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isGenerating ? 'Generating design tokens…' : 'Generate Design Tokens'}
      </button>
    </div>
  );
}
