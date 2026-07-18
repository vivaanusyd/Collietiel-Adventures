import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { remarkEmotionIcons } from './remark-emotion-icons.mjs';

// Renders a Markdown STRING to HTML, for text blocks in a review's
// `blocks:` list (see src/components/Blocks.astro).
//
// WHY THIS EXISTS AT ALL
//
// Astro's `entry.render()` only works on a whole content-collection entry —
// there's no built-in way to render an arbitrary Markdown string held in
// frontmatter. Without this, a text block would have to be plain text or
// raw HTML, and the emotion icons that are the site's main expressive tool
// would work in the body but silently not work in a block. Writers would
// have no way to know why.
//
// WHY @astrojs/markdown-remark IS AN EXPLICIT DEPENDENCY
//
// It ships inside Astro already, so this could have imported it as a
// transitive dependency for free. It's listed in package.json instead
// because depending on someone else's transitive dep is how builds break on
// an unrelated upgrade — the same reasoning that keeps
// remark-emotion-icons.mjs from importing unist-util-visit. It's first-party
// Astro tooling on Astro's own release cadence, which makes it a cheap
// dependency to own outright rather than a risk to inherit.

// The processor is created ONCE and reused. Building it parses and wires the
// whole remark/rehype pipeline; doing that per block would repeat that work
// for every paragraph on every page. The promise is cached rather than the
// resolved value so that concurrent first calls share one construction.
let processor: ReturnType<typeof createMarkdownProcessor> | null = null;

function getProcessor() {
  // Same plugin list as astro.config.mjs. These two have to agree, or a
  // shortcode would render in the body and stay literal in a block.
  processor ??= createMarkdownProcessor({
    remarkPlugins: [remarkEmotionIcons],
  });
  return processor;
}

/** Markdown string -> HTML string, with emotion icon shortcodes applied. */
export async function renderMarkdown(markdown: string): Promise<string> {
  const { code } = await (await getProcessor()).render(markdown);
  return code;
}
