# ADR-0203: Permissions Declared in Manifest and Verified via Static Analysis

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 27 — Code Generation

## Context

Functions declare required permissions in their manifest. Without verification, declarations could be inaccurate — either declaring too many (over-provisioned) or too few (runtime failures or security gaps).

## Decision

Every generated function's permission declarations are cross-checked against the implementation via static analysis and the `permission-derivation` AI prompt. Missing permissions are added automatically; excess permissions surface as warnings. The verification result is shown in the Analysis tab of the code review UI.

At runtime, the platform enforces permissions at invocation time — an undeclared permission is denied even if the function calls the corresponding SDK method.

## Consequences

- Runtime permission failures are caught at generation time rather than post-deployment
- Over-provisioned functions are flagged, reducing blast radius if a function is compromised
- Permission derivation is automated; customers rarely need to manually adjust declarations

## Alternatives considered

- **Trust AI declarations without verification** — risk of over/under-provisioning; discovered too late
