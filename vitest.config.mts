import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));
const graphqlEntry = path.join(root, 'node_modules/graphql/index.js');

// Vite prefers graphql's ESM build, while the Apollo packages require the
// CommonJS build. Pin both to the same file so schema classes pass instanceof.
const graphqlCjs: Plugin = {
  name: 'graphql-cjs',
  enforce: 'pre',
  resolveId(source) {
    if (source === 'graphql') {
      return { id: graphqlEntry, external: true };
    }
    return null;
  },
};

export default defineConfig({
  plugins: [graphqlCjs],
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
