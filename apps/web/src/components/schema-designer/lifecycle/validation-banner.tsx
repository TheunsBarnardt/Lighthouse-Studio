'use client';

import { Badge } from '@/components/ui/badge';
import { useDesignerStore } from '@/state/designer-store';

export function ValidationBanner() {
  const validationReport = useDesignerStore((s) => s.validationReport);

  if (!validationReport) return null;

  const { valid, errors, warnings, info } = validationReport;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Validation results"
      className="flex items-center gap-3 border-b bg-card px-4 py-2 text-sm"
    >
      <span className={valid ? 'font-semibold text-success' : 'font-semibold text-error'}>
        {valid ? '✓ Valid' : '✗ Invalid'}
      </span>

      {errors.length > 0 && (
        <Badge variant="error">
          {errors.length} error{errors.length !== 1 ? 's' : ''}
        </Badge>
      )}
      {warnings.length > 0 && (
        <Badge variant="warning">
          {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
        </Badge>
      )}
      {info.length > 0 && <Badge variant="info">{info.length} info</Badge>}

      {/* Show first error message for quick visibility */}
      {errors[0] && (
        <span className="truncate text-xs text-error">
          {errors[0].path}: {errors[0].message}
        </span>
      )}
    </div>
  );
}
