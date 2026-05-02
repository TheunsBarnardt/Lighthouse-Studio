# @platform/config

Shared TypeScript, ESLint, and Prettier configurations for all packages in the monorepo.

## Usage

In any package `tsconfig.json`:

```json
{ "extends": "@platform/config/tsconfig/lib.json" }
```

In any package `eslint.config.mjs`:

```js
import config from '@platform/config/eslint';
export default config;
```

In the root `prettier.config.mjs`:

```js
export { default } from '@platform/config/prettier';
```
