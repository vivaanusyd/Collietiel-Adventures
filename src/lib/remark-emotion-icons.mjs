import { EMOTIONS } from './emotions.mjs';
import { availableIcons, hasIcon } from './icons.mjs';

// Turns `:collie-smiling:` in review Markdown into an inline <img>.
//
// WHY A PLUGIN AND NOT MDX: Astro components can't be used inside plain
// .md. The alternatives were switching every review to .mdx (a new
// dependency, and all content files change) or typing raw <img> tags in
// prose. Since these get used constantly mid-sentence, the shortest thing
// to type wins, and this costs no dependency — remark already ships inside
// Astro's Markdown pipeline.
//
// TO EXTEND: add to EMOTIONS in emotions.mjs + drop the PNG in
// public/icons/. Nothing here needs touching.

// Requires a leading lowercase letter, so ordinary prose is left alone:
// "12:30", "3:1 ratio" and "note: this" all fail to match.
const SHORTCODE = /:([a-z][a-z0-9-]*):/g;

// Verify every declared emotion actually has artwork. Runs once per build —
// catches a map entry added without its PNG, which would otherwise ship as
// a broken image.
//
// Goes through icons.mjs rather than doing its own fs check against a path
// built here. Two copies of "where is public/icons/" was one too many: this
// one silently resolved to the wrong folder when the plugin ran from bundled
// build output, and then reported every icon as missing.
let verified = false;
function verifyArtworkExists() {
  if (verified) return;
  const missing = Object.keys(EMOTIONS).filter((name) => !hasIcon(name));
  if (missing.length > 0) {
    throw new Error(
      `[emotion-icons] Declared in emotions.mjs but no PNG in public/icons/: ${missing.join(', ')}\n` +
        `  Found: ${availableIcons().join(', ')}`
    );
  }
  verified = true;
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Split one text node into text/html/text pieces. Returns null when the
 * node holds no shortcodes, so the common case allocates nothing.
 */
function splitTextNode(node, filePath) {
  const value = node.value;
  SHORTCODE.lastIndex = 0;
  if (!SHORTCODE.test(value)) return null;
  SHORTCODE.lastIndex = 0;

  const out = [];
  let last = 0;
  let match;

  while ((match = SHORTCODE.exec(value)) !== null) {
    const [full, name] = match;

    // Unknown name → leave the text exactly as written and warn. Chosen over
    // throwing because a build that dies on an innocent colon in prose would
    // be worse than a visible `:typo:` in the rendered page plus a terminal
    // warning. You see it either way.
    if (!Object.hasOwn(EMOTIONS, name)) {
      console.warn(
        `[emotion-icons] Unknown icon ":${name}:" in ${filePath}\n` +
          `  Valid: ${Object.keys(EMOTIONS).join(', ')}`
      );
      continue;
    }

    if (match.index > last) {
      out.push({ type: 'text', value: value.slice(last, match.index) });
    }
    // width/height are the artwork's intrinsic size (every icon is 128x128).
    // CSS still controls the rendered size in `em` — these attributes only
    // hand the browser the aspect ratio up front, so a line of text doesn't
    // reflow sideways as each icon finishes loading.
    out.push({
      type: 'html',
      value: `<img class="emotion-icon" src="/icons/${name}.png" alt="${escapeAttr(EMOTIONS[name])}" width="128" height="128" />`,
    });
    last = match.index + full.length;
  }

  if (out.length === 0) return null;
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
  return out;
}

export function remarkEmotionIcons() {
  return (tree, file) => {
    verifyArtworkExists();
    const filePath = file?.history?.[0] ?? 'unknown file';

    // Hand-rolled walk rather than importing unist-util-visit — that's only
    // present as a transitive dependency of Astro, and depending on someone
    // else's transitive dep is how builds break on an unrelated upgrade.
    const walk = (node) => {
      if (!Array.isArray(node.children)) return;

      // `code` and `inlineCode` children are not `text` nodes, so shortcodes
      // inside backticks are naturally left alone — that's how you write
      // about the syntax in a review without triggering it.
      const next = [];
      let changed = false;
      for (const child of node.children) {
        if (child.type === 'text') {
          const pieces = splitTextNode(child, filePath);
          if (pieces) {
            next.push(...pieces);
            changed = true;
            continue;
          }
        }
        walk(child);
        next.push(child);
      }
      if (changed) node.children = next;
    };

    walk(tree);
  };
}
