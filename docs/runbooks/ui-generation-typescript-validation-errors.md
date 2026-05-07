# Runbook: Generated Component Fails TypeScript Validation

## Symptoms

- `TypeCheckReport.passed === false` on a generated component
- Code viewer shows `TypeScript ✗` badge instead of `TypeScript ✓`
- Customer reports type errors when running `tsc` on exported project

## Steps

1. Retrieve the type check report for the component:
   ```
   GET /api/ui-generation/projects/<id>/components/<name>/type-check
   ```
   Review `errors[]` for the specific TS error codes.

2. Common errors and causes:

   | TS Error | Cause | Fix |
   |----------|-------|-----|
   | `TS2345` (arg not assignable) | Schema type mismatch in generated SDK call | Regenerate with feedback: "use `string \| null` for nullable column" |
   | `TS2339` (property does not exist) | Component references a column not in schema | Check IA sync with current schema; regenerate IA if schema changed after IA generation |
   | `TS7006` (implicit any) | `strict: true` caught an untyped parameter | Regenerate; the model omitted an explicit type annotation |
   | `TS2304` (cannot find name) | Import missing from generated file | Regenerate; the model forgot an import statement |

3. For systematic errors (multiple components failing same error code), check if the schema changed after IA generation. If so, regenerate the IA first (`POST /api/ui-generation/projects/<id>/ia/regenerate`), then regenerate affected components.

4. If type errors appear in the exported project but not in the platform's validator, the platform's heuristic TypeChecker missed them. File an issue referencing the specific pattern so the TypeChecker heuristics can be improved.

## Prevention

- The platform runs heuristic type checking synchronously during generation.
- Production deployments use `ts.createProgram` for full validation; the heuristic is a fast approximation only.
- Monitor `ui_generation_typecheck_failure_rate` per workspace.
