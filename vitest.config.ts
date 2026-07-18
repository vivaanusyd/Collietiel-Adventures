import { defineConfig } from 'vitest/config';

// Node environment, not jsdom — both units under test are pure string/AST
// transforms that run at build time. Nothing here touches a DOM, and a
// jsdom environment would only make the suite slower to start.
export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,mjs}'],
    environment: 'node',
  },
});
