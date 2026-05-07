'use client';

interface CodeViewerPanelProps {
  filePath: string;
  content: string;
  onApprove: () => void;
  onRegenerate: () => void;
}

export function CodeViewerPanel({ filePath, content, onApprove, onRegenerate }: CodeViewerPanelProps) {
  const lines = content.split('\n');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-mono text-muted-foreground">{filePath}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">TypeScript ✓ · A11y ✓</span>
          <button
            onClick={onRegenerate}
            className="px-2.5 py-1 text-xs border border-border rounded hover:bg-muted"
          >
            ↻ Regenerate
          </button>
          <button
            onClick={onApprove}
            className="px-2.5 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            ✓ Approve
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-background">
        <table className="w-full text-xs font-mono">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-muted/20 group">
                <td className="select-none w-12 text-right pr-4 text-muted-foreground border-r border-border/30 py-0.5 pl-2">
                  {i + 1}
                </td>
                <td className="pl-4 py-0.5 whitespace-pre text-foreground">
                  {line || ' '}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
