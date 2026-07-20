import { describe, expect, it } from 'vitest';
import {
  DESK_DEFAULT_STYLES,
  DESK_FONTS,
  deskPlainText,
  flowMargins,
  floatOffsetCorrection,
  floatsByAnchor,
  resolveTextStyle,
  sanitizeDeskHtml,
} from '../src/lib/desk-render.mjs';

// desk-render.mjs is a transcription of the Sunday Table editor's own layout
// maths, and a transcription can be wrong in a way that still renders: a
// paragraph that is 1px out, a float on the wrong side of the text. These
// tests pin the values that decide where things land, so a re-export of the
// editor that changes them shows up as a red test rather than as a review
// that quietly no longer looks like what its writer arranged.

describe('text styling', () => {
  it('falls back to the group style for a kind of text', () => {
    const style = resolveTextStyle({ kind: 'text', type: 'quote' }, DESK_DEFAULT_STYLES);
    expect(style.fontSize).toBe(22);
    expect(style.italic).toBe(true);
    expect(style.color).toBe('#a8720c');
  });

  it('lets a block override its group', () => {
    const style = resolveTextStyle(
      { kind: 'text', type: 'body', size: 31, color: '#123456', bold: true },
      DESK_DEFAULT_STYLES
    );
    expect(style.fontSize).toBe(31);
    expect(style.color).toBe('#123456');
    expect(style.bold).toBe(true);
    // Line height is deliberately NOT overridable per block in the editor.
    expect(style.lineHeight).toBe(DESK_DEFAULT_STYLES.body.lh);
  });

  it('keeps a block-level false, which is not the same as absent', () => {
    // `bold: false` on a heading has to win over the group's `bold: true`.
    // Written as `b.bold != null ? ... : gs.bold` in both files for exactly
    // this case — `||` would silently re-bold the heading.
    const style = resolveTextStyle(
      { kind: 'text', type: 'heading', bold: false },
      DESK_DEFAULT_STYLES
    );
    expect(style.bold).toBe(false);
  });

  it('resolves a font key to the editor’s stack, and an unknown one to serif', () => {
    expect(
      resolveTextStyle({ kind: 'text', type: 'body', fontKey: 'mono' }, DESK_DEFAULT_STYLES)
        .fontFamily
    ).toBe(DESK_FONTS.mono);
    expect(
      resolveTextStyle({ kind: 'text', type: 'body', fontKey: 'nope' }, DESK_DEFAULT_STYLES)
        .fontFamily
    ).toBe(DESK_FONTS.serif);
  });

  it('survives a document whose styles are missing entirely', () => {
    expect(() => resolveTextStyle({ kind: 'text', type: 'body' }, undefined)).not.toThrow();
    expect(resolveTextStyle({ kind: 'text', type: 'body' }, {}).fontSize).toBe(17);
  });
});

describe('flow spacing', () => {
  // These margins decide where every later block starts, and therefore where
  // every float anchored to those blocks ends up.
  it('matches the editor’s per-kind margins', () => {
    expect(flowMargins({ kind: 'text', type: 'heading' })).toEqual({ top: 16, bottom: 7 });
    expect(flowMargins({ kind: 'text', type: 'subheading' })).toEqual({ top: 12, bottom: 7 });
    expect(flowMargins({ kind: 'text', type: 'body' })).toEqual({ top: 0, bottom: 18 });
    expect(flowMargins({ kind: 'text', type: 'caption' })).toEqual({ top: 0, bottom: 8 });
    expect(flowMargins({ kind: 'banner', media: 0 })).toEqual({ top: 6, bottom: 22 });
  });
});

describe('float anchoring', () => {
  it('groups floats by the block they are pinned to, keeping order', () => {
    const groups = floatsByAnchor([
      { id: 1, anchor: 2, dx: 0, dy: 0, w: 1, h: 1, kind: 'shape', shape: 'circle' },
      { id: 2, anchor: '$meta', dx: 0, dy: 0, w: 1, h: 1, kind: 'shape', shape: 'circle' },
      { id: 3, anchor: 2, dx: 0, dy: 0, w: 1, h: 1, kind: 'shape', shape: 'circle' },
    ]);
    expect([...groups.keys()]).toEqual(['2', '$meta']);
    expect(groups.get('2').map((f) => f.id)).toEqual([1, 3]);
  });

  it('normalises a numeric anchor to a string key, so lookups by block id hit', () => {
    // The renderer looks up String(item.id). A number key here would mean
    // every float silently vanishes — the failure this test exists for.
    const groups = floatsByAnchor([
      { id: 1, anchor: 7, dx: 0, dy: 0, w: 1, h: 1, kind: 'shape', shape: 'square' },
    ]);
    expect(groups.get('7')).toHaveLength(1);
  });

  it('subtracts the text wrapper’s border, and only for text', () => {
    // The editor stores dx/dy against the border box; CSS positions from the
    // padding box. 1.5px on a paragraph, nothing on a banner.
    expect(floatOffsetCorrection({ kind: 'text', type: 'body' })).toBe(1.5);
    expect(floatOffsetCorrection({ kind: 'banner', media: 0 })).toBe(0);
    expect(floatOffsetCorrection(undefined)).toBe(0);
  });
});

describe('sanitising desk text', () => {
  // The editor sanitises on save — in the writer's browser, on their copy.
  // This content reaches the site through a pull request, so the guarantee
  // has to be re-made here, at build time, before it goes through set:html.
  it('keeps the inline formatting the editor allows', () => {
    expect(sanitizeDeskHtml('a <b>bold</b> and <em>italic</em> line<br>next')).toBe(
      'a <b>bold</b> and <em>italic</em> line<br />next'
    );
  });

  it('unwraps a tag it does not know, keeping the words', () => {
    expect(sanitizeDeskHtml('<div>kept</div>')).toBe('kept');
    expect(sanitizeDeskHtml('<span style="color:red">kept</span>')).toBe('kept');
  });

  it('drops a script and its contents, not just its tag', () => {
    expect(sanitizeDeskHtml('before<script>alert(1)</script>after')).toBe('beforeafter');
    expect(sanitizeDeskHtml('<style>body{display:none}</style>x')).toBe('x');
  });

  it('strips event handlers by rebuilding the tag rather than filtering it', () => {
    expect(sanitizeDeskHtml('<b onclick="steal()">hi</b>')).toBe('<b>hi</b>');
    // Attribute spelled unusually — the reason tags are rebuilt, not filtered.
    expect(sanitizeDeskHtml('<b OnClick = "steal()">hi</b>')).toBe('<b>hi</b>');
  });

  it('allows a safe link and neuters an unsafe one', () => {
    expect(sanitizeDeskHtml('<a href="https://example.com">x</a>')).toBe(
      '<a href="https://example.com" rel="noopener noreferrer nofollow" target="_blank">x</a>'
    );
    expect(sanitizeDeskHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeDeskHtml('<a href="/reviews/x">x</a>')).toContain('href="/reviews/x"');
  });

  it('removes comments, which can hide markup from a reviewer', () => {
    expect(sanitizeDeskHtml('a<!-- <script>x</script> -->b')).toBe('ab');
  });

  it('is unbothered by an empty or absent value', () => {
    expect(sanitizeDeskHtml(undefined)).toBe('');
    expect(sanitizeDeskHtml('')).toBe('');
  });
});

describe('plain text', () => {
  const doc = {
    flow: [
      { id: 1, kind: 'text', type: 'heading', text: 'The food' },
      { id: 2, kind: 'banner', media: 0 },
      { id: 3, kind: 'text', type: 'body', text: 'two <b>words</b>&nbsp;here<br>and more' },
    ],
  };

  it('reads the words a reader reads, and nothing else', () => {
    expect(deskPlainText(doc)).toBe('The food two words here and more');
  });

  it('is empty for a document with no text, rather than throwing', () => {
    expect(deskPlainText({ flow: [] })).toBe('');
    expect(deskPlainText(undefined)).toBe('');
    expect(deskPlainText({})).toBe('');
  });
});
