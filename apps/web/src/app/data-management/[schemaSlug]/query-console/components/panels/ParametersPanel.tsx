'use client';

interface ParametersPanelProps {
  paramNames: string[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

export function ParametersPanel({ paramNames, values, onChange }: ParametersPanelProps) {
  if (paramNames.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No named parameters found. Use <code className="mx-1 rounded bg-muted px-1">:name</code> syntax in your query.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-3">
      {paramNames.map((name) => (
        <div key={name} className="flex flex-col gap-1">
          <label htmlFor={`param-${name}`} className="text-xs font-medium text-muted-foreground">
            :{name}
          </label>
          <input
            id={`param-${name}`}
            type="text"
            value={values[name] ?? ''}
            onChange={(e) => { onChange(name, e.target.value); }}
            placeholder={`Value for :${name}`}
            className="rounded border bg-background px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      ))}
    </div>
  );
}
