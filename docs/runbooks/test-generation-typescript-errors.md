# Runbook: Generated Test Files Have TypeScript Errors

## Symptoms

- Test file shows TypeScript errors in the code viewer
- Test run fails with compilation errors before any tests execute
- `tsc` output includes errors in `src/__tests__/` directory

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find module '../service'` | Incorrect relative import path | Regenerate with feedback: "Fix import path — service is at src/services/auth.service.ts" |
| `Type 'string' is not assignable to type 'number'` | Schema type mismatch in factory | Regenerate mock factories after schema update |
| `Property 'X' does not exist on type 'Y'` | Generated code references a field the AI hallucinated | Provide the correct type definition in regeneration feedback |
| `vi is not defined` | Missing vitest globals config | Add `globals: true` to vitest config and regenerate |

## Steps

1. Identify the specific TypeScript error in the test file viewer.

2. Click **Regenerate** on the affected test file and include the error message in the feedback field.

3. If the error is systemic (many files have the same import path error): update `vitest.config.ts` path aliases to match the project structure, then regenerate the affected tests.

4. For `vi is not defined` errors across all files: the generated `vitest.config.ts` is missing `test.globals: true`. Edit the config file directly.

## Prevention

- The test generation prompts include the project structure to guide import paths
- TypeScript compilation is validated after generation; errors trigger one automatic fix attempt
