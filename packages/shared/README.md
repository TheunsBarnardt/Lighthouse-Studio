# @platform/shared

Pure TypeScript utilities with no business logic and no external service dependencies. Every package in the monorepo may depend on this; it must never depend on any `@platform/*` package in return.

## Contents

- **`result/`** — Re-exports from `neverthrow` plus `safeAsync` helper for wrapping throwing promises
- **`errors/`** — Base `AppError` class and typed subclasses used throughout the platform
- **`platform/`** — Cross-platform path and process utilities (Linux + Windows compatible)
