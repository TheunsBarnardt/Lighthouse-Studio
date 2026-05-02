export default {
  '*.{ts,tsx,mts,cts,mjs,cjs,js,jsx}': [
    'eslint --fix --max-warnings=0 --no-warn-ignored',
    'prettier --write',
  ],
  '*.{json,yml,yaml}': ['prettier --write'],
  '*.md': ['prettier --write'],
};
