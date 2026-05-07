'use client';

import { DollarSign } from 'lucide-react';
import { useState } from 'react';

interface CostIndicatorProps {
  totalCostUsd: number;
  lastTurnCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export function CostIndicator({
  totalCostUsd,
  lastTurnCostUsd,
  inputTokens,
  outputTokens,
}: CostIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <button
        onMouseEnter={() => {
          setShowTooltip(true);
        }}
        onMouseLeave={() => {
          setShowTooltip(false);
        }}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <DollarSign className="w-3 h-3" />
        <span>{totalCostUsd < 0.01 ? '<$0.01' : `$${totalCostUsd.toFixed(3)}`}</span>
      </button>
      {showTooltip && (
        <div className="absolute bottom-full right-0 mb-2 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded shadow-lg whitespace-nowrap z-10">
          <div>Total cost: ${totalCostUsd.toFixed(4)}</div>
          {lastTurnCostUsd !== undefined && <div>Last turn: ${lastTurnCostUsd.toFixed(4)}</div>}
          {inputTokens !== undefined && <div>Input tokens: {inputTokens.toLocaleString()}</div>}
          {outputTokens !== undefined && <div>Output tokens: {outputTokens.toLocaleString()}</div>}
        </div>
      )}
    </div>
  );
}
