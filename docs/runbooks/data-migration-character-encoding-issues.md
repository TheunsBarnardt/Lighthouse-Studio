# Runbook: Character Encoding Issues in File Sources

**Trigger:** CSV or Excel file contains non-UTF-8 characters; migration produces garbled or truncated text.

## Symptoms

- String columns contain `?` or `�` characters after migration
- File introspection detects encoding as Latin-1, Windows-1252, or UTF-16
- Special characters (accented letters, currency symbols) are corrupted

## Investigation

### 1. Detect source encoding

The file adapter attempts to detect encoding via byte-order marks and frequency analysis. Check the introspection result:

```typescript
const description = artifact.plan.sourceDescription;
description.tables[0]?.columns[0]?.inferredType; // may include encoding hint
```

### 2. Confirm with sample values

In the introspection step, look at sample values for columns with text data. If they contain replacement characters or question marks, the encoding detection failed.

## Remediation

### Option A: Specify encoding in the source upload step

When uploading a CSV file, specify the encoding explicitly:
- `encoding: 'latin1'` for ISO-8859-1
- `encoding: 'windows-1252'` for Windows codepage 1252
- `encoding: 'utf-16le'` for UTF-16 LE (common in Excel exports)

The CSV adapter re-reads the file with the specified encoding.

### Option B: Pre-convert the file

Use `iconv` (or a spreadsheet program) to convert the file to UTF-8 before uploading:
```bash
iconv -f windows-1252 -t utf-8 source.csv > source_utf8.csv
```

Upload the converted file.

### Option C: Transformation at column level

For columns known to have encoding issues, add a `regex_replace` transformation to fix common encoding artifacts:
- `â` → `'` (smart quote artifact)
- Custom `js_expression` for complex remapping

## Prevention

- Always display detected encoding in the IntrospectionStep UI; prompt user to confirm or override
- Validate that all string columns contain valid UTF-8 before generating the mapping
- Add charset validation to the pre-execution checks
