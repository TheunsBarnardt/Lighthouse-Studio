# Runbook: Design Tokens Export Format Change

**Trigger:** Adding a new export format target, or an existing exporter needs to update its output structure.

## Adding a New Export Format

### 1. Create the exporter

Create `packages/core/src/services/ai/design-tokens/exporters/<format>-exporter.ts` implementing:

```typescript
export class NewFormatExporter {
  export(tokenSet: DesignTokenSet): { content: string; filename: string } {
    // Transform tokenSet → format-specific string
    return { content: '...', filename: 'tokens.xyz' };
  }
}
```

### 2. Register the format

In `packages/core/src/services/ai/design-tokens/types.ts`, add the new format to `ExportFormat`:

```typescript
export type ExportFormat = 'css' | 'tailwind' | 'json_dtcg' | 'typescript' | 'new_format';
```

### 3. Wire into the service

In `design-tokens.service.ts` `_export()` method, add a case:

```typescript
case 'new_format':
  result = new NewFormatExporter().export(artifact.tokenSet);
  break;
```

### 4. Add to the ExportDialog

In `apps/web/src/app/ai-pipeline/design-tokens/dialogs/ExportDialog.tsx`, add an entry to `FORMATS`:

```typescript
{ id: 'new_format', label: 'New Format', description: '...', filename: 'tokens.xyz' },
```

### 5. Test

Add unit tests for the exporter with a fixture token set. Verify:
- All expected keys are present in the output
- No undefined values appear
- The output is valid for the target format (e.g., parseable JSON, valid JS)

## Updating an Existing Exporter

If a format spec changes (e.g., DTCG publishes a new version), update the relevant exporter class. The service and UI don't need changes.

Run the exporter unit tests to verify no regression.

## Compatibility Note

Exported files may have been downloaded by customers and integrated into their build pipelines. Breaking changes to export formats should be versioned if possible (e.g., `tokens-v2.json`) or announced with migration guidance.
