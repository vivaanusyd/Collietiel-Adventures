import { getViteConfig } from 'astro/config';

// Vitest ran on Vite's defaults until now, which was enough while every test
// read a plain .mjs or .ts file. test/desk-review.test.mjs renders a real
// .astro component, and nothing but Astro's own Vite config knows how to
// compile one — without this it fails with a syntax error pointing at
// perfectly valid template markup.
//
// getViteConfig is Astro's supported way to do this; it reuses the project's
// astro.config.mjs, so a test renders components with the same plugins and
// aliases the site builds them with, rather than a second configuration that
// can drift from it.
export default getViteConfig({
  test: {
    // Matches what `npm run test:unit` ran before this file existed, so
    // adding it changes which files can be compiled, not which are run.
    include: ['test/**/*.test.{mjs,ts}'],
  },
});
