/** @type {import('lint-staged').Config} */
module.exports = {
  '**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs,json,css}': 'bun run lint:staged',
  '**/*/package.json': 'bun run precommit',
};
