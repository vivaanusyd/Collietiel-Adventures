// The layout rules of the Sunday Table editor, mirrored for the published
// page.
//
// WHY THIS FILE EXISTS
//
// A review written in the Sunday Table is not a filled-in form. It's a page
// someone arranged: photos at an angle in the margin, a coloured circle
// behind a heading, a font chosen per paragraph. None of that survives being
// squashed into the block vocabulary in blocks.ts, so a desk review is
// stored VERBATIM (see the `desk` field in src/content/config.ts) and drawn
// by DeskReview.astro using the numbers below.
//
// Which makes this the second copy of a layout, and second copies drift.
// It's the same trade layout.mjs already makes for the canvas editor, and
// the same defence applies: the values live in ONE file that both the
// renderer and its tests read, and the tests below pin them against the
// editor's own numbers. When the desk is re-exported from Claude Design,
// this is the file to check against it — everything the published page
// needs to look right is here, and nothing else in src/ hardcodes it.
//
// The values are transcribed from the editor's own render(), not invented.
// Where a number looks arbitrary (46px, 1.5px, -48px) it is arbitrary — it
// is what the editor does, which is the whole requirement.

/**
 * Font stacks, keyed exactly as the editor keys them.
 *
 * NOTE: these families are not self-hosted by this site, which only ships
 * Fraunces and Inter. A reader whose machine has none of them sees the
 * fallback (Georgia / system-ui), so a review set in Playfair renders in
 * Georgia — close in feel, not identical. Fixing that means self-hosting
 * eight more families; until then this is the one honest gap between the
 * desk and the page, and it is written down in docs/DEVELOPING.md rather
 * than left for someone to notice.
 */
export const DESK_FONTS = {
  serif: "'Source Serif 4', Georgia, serif",
  lora: "'Lora', Georgia, serif",
  playfair: "'Playfair Display', Georgia, serif",
  baskerville: "'Libre Baskerville', Georgia, serif",
  sans: "'Nunito', system-ui, sans-serif",
  worksans: "'Work Sans', system-ui, sans-serif",
  grotesk: "'Space Grotesk', system-ui, sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

/** The editor's accent, used by quote bars and the star row. */
export const DESK_ACCENT = '#e8a13c';

/** Paper geometry. `pageWidth` is a desk setting; 720 is its default. */
export const DESK_PAGE_WIDTH = 720;
export const DESK_PAPER_PADDING_X = 48;

/**
 * Per-kind text defaults, overridable per block. Transcribed from the
 * editor's defaultStyles().
 */
export const DESK_DEFAULT_STYLES = {
  heading: {
    fontKey: 'serif',
    size: 27,
    lh: 1.2,
    color: '#4a3a28',
    bold: true,
    italic: false,
    align: 'left',
  },
  subheading: {
    fontKey: 'serif',
    size: 20,
    lh: 1.3,
    color: '#8a5a1a',
    bold: true,
    italic: false,
    align: 'left',
  },
  body: {
    fontKey: 'serif',
    size: 17,
    lh: 1.7,
    color: '#5c4a32',
    bold: false,
    italic: false,
    align: 'left',
  },
  quote: {
    fontKey: 'serif',
    size: 22,
    lh: 1.5,
    color: '#a8720c',
    bold: false,
    italic: true,
    align: 'left',
  },
  caption: {
    fontKey: 'serif',
    size: 12,
    lh: 1.5,
    color: '#8a6a30',
    bold: false,
    italic: true,
    align: 'center',
  },
};

/**
 * A text block's resolved appearance: the group style for its kind, with
 * any per-block override on top. Mirrors the editor's own precedence, where
 * `b.size || gs.size` means a block-level 0 falls back — matched here rather
 * than "corrected", so the two can't disagree.
 */
export function resolveTextStyle(block, styles = {}) {
  const group = styles[block.type] || styles.body || DESK_DEFAULT_STYLES.body;
  return {
    fontFamily: DESK_FONTS[block.fontKey || group.fontKey] || DESK_FONTS.serif,
    fontSize: block.size || group.size,
    lineHeight: group.lh,
    color: block.color || group.color,
    bold: block.bold != null ? block.bold : group.bold,
    italic: block.italic != null ? block.italic : group.italic,
    align: block.align || group.align || 'left',
  };
}

/**
 * The vertical margins around a flow block, which decide where every block
 * after it lands — and therefore where every float anchored to those blocks
 * lands. Getting these wrong doesn't look like a spacing bug, it looks like
 * the photos have slid.
 */
export function flowMargins(block) {
  if (block.kind !== 'text') return { top: 6, bottom: 22 };
  const type = block.type;
  const bottom = type === 'heading' || type === 'subheading' ? 7 : type === 'caption' ? 8 : 18;
  const top = type === 'heading' ? 16 : type === 'subheading' ? 12 : 0;
  return { top, bottom };
}

/**
 * How far a float's stored offset must be nudged when it becomes a CSS
 * absolute child of its anchor.
 *
 * The editor stores `dx`/`dy` against the anchor's BORDER box (that's what
 * getBoundingClientRect returns). CSS positions an absolute child against
 * its containing block's PADDING box. For text blocks those differ by the
 * 1.5px transparent border the editor keeps on every text wrapper, so
 * without this every float against a paragraph sits 1.5px off — invisible
 * on one, visible when several line up.
 */
export function floatOffsetCorrection(anchorBlock) {
  return anchorBlock && anchorBlock.kind === 'text' ? 1.5 : 0;
}

/** Floats grouped by what they're anchored to, preserving document order. */
export function floatsByAnchor(floats = []) {
  const groups = new Map();
  for (const float of floats) {
    // `$meta` is the header; anything else is a flow block id. Numbers and
    // strings both appear in saved documents, so the key is normalised.
    const key = float.anchor === '$meta' ? '$meta' : String(float.anchor);
    const existing = groups.get(key);
    if (existing) existing.push(float);
    else groups.set(key, [float]);
  }
  return groups;
}

// --- text ----------------------------------------------------------------

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'a']);
const SAFE_HREF = /^(https?:|mailto:|#|\/)/i;

/**
 * Rebuild a fragment of desk text with only the tags the editor allows.
 *
 * The editor already sanitises on save — but that runs in the writer's
 * browser, on their copy, and this content arrives here through a pull
 * request. Anything a browser did on the way in is a convenience, not a
 * guarantee, and this is the point where it becomes a page other people
 * load. So it is sanitised again here, at build time, before `set:html`.
 *
 * Tags are REBUILT rather than filtered: an allowed tag is re-emitted from
 * scratch with only the attributes named below, so no attribute can survive
 * by being spelled unusually. A disallowed tag is dropped and its text kept,
 * matching the editor's unwrap behaviour.
 */
export function sanitizeDeskHtml(input) {
  let html = String(input ?? '');

  // Elements whose CONTENT is dangerous, not just their tag — dropping the
  // tag alone would dump the script body onto the page as text.
  html = html.replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, '');
  html = html.replace(/<(script|style|iframe|object|embed)\b[^>]*>/gi, '');
  html = html.replace(/<!--[\s\S]*?-->/g, '');

  return html.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g,
    (tag, rawName, attrs) => {
      const name = rawName.toLowerCase();
      if (!ALLOWED_TAGS.has(name)) return '';
      if (tag.startsWith('</')) return `</${name}>`;
      if (name === 'br') return '<br />';
      if (name === 'a') {
        const href = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs || '');
        const value = href ? (href[2] ?? href[3] ?? href[4] ?? '').trim() : '';
        if (!value || !SAFE_HREF.test(value)) return '<a>';
        // Same trailer the editor adds: an outbound link from a review is not
        // an endorsement, and it should not hand the target a window handle.
        return `<a href="${escapeAttr(value)}" rel="noopener noreferrer nofollow" target="_blank">`;
      }
      return `<${name}>`;
    }
  );
}

function escapeAttr(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

/**
 * Every word a reader actually reads, in order.
 *
 * Used for reading time. Deliberately not used for search or RSS: both index
 * frontmatter (name, cuisine, blurb), so a desk review is already findable
 * without teaching them a second body format.
 */
export function deskPlainText(doc) {
  if (!doc || !Array.isArray(doc.flow)) return '';
  const parts = [];
  for (const block of doc.flow) {
    if (block.kind !== 'text' || !block.text) continue;
    parts.push(
      String(block.text)
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&(#?[a-zA-Z0-9]+);/g, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
    );
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
