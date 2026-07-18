import { defineConfig } from 'astro/config';
import { remarkEmotionIcons } from './src/lib/remark-emotion-icons.mjs';

// Static output — no server needed. Both Netlify and Vercel detect Astro
// automatically and build this with their zero-config static presets
// (Netlify: `astro build` -> publish `dist/`; Vercel: Astro preset).
// If you later add a form handler or auth, that's when an adapter
// (@astrojs/netlify or @astrojs/vercel) would become necessary.
export default defineConfig({
  site: 'https://example.com', // replace with your real domain once deployed
  output: 'static',
  markdown: {
    // Lets reviews write `:collie-smiling:` inline. See the plugin file.
    remarkPlugins: [remarkEmotionIcons],
  },
});
