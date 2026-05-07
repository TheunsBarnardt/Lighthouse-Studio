# Runbook: Documentation Export Exceeds Size Limit

**Severity:** Medium
**Trigger:** An export fails or produces a ZIP over 50 MB

---

## Symptoms

- Export status shows `failed` with "Export size exceeded limit"
- Or: export succeeds but the ZIP is unusably large

---

## Diagnosis

1. Count the number of documentation pages — large projects with 100+ pages can produce large exports
2. Check whether workspace brand assets are oversized (large logo images, custom fonts)
3. Check whether any human-maintained MDX sections embed base64-encoded images

---

## Resolution

1. **Remove embedded images from MDX** — use URLs instead of base64 data URIs
2. **Compress workspace logo** — resize to 200×200 max, use WebP format
3. **Limit export scope** — if only some sections need to be distributed, use a section filter
   in the export dialog (future: select which doc sections to include)

---

## Prevention

- Validate workspace asset sizes at upload time (max 100 KB per image)
- Warn in the export dialog if the estimated export size exceeds 40 MB before generation starts
