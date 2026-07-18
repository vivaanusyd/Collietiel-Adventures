import { defineConfig } from 'astro/config';
import { remarkEmotionIcons } from './src/lib/remark-emotion-icons.mjs';

// Static output — no server needed. Both Netlify and Vercel detect Astro
// automatically and build this with their zero-config static presets
// (Netlify: `astro build` -> publish `dist/`; Vercel: Astro preset).
// If you later add a form handler or auth, that's when an adapter
// (@astrojs/netlify or @astrojs/vercel) would become necessary.
export default defineConfig({
  // Canonical URLs, RSS links, the sitemap and social preview images all
  // derive from this. If you later move to a custom domain, change it here
  // and in the Sitemap: line of public/robots.txt — those are the only two
  // places the domain is written down.
  site: 'https://collietiel-adventures.netlify.app',
  output: 'static',
  markdown: {
    // Lets reviews write `:collie-smiling:` inline. See the plugin file.
    remarkPlugins: [remarkEmotionIcons],
  },
});
