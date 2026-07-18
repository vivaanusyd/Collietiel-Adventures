import { describe, expect, it, vi } from 'vitest';
import { remarkEmotionIcons } from '../src/lib/remark-emotion-icons.mjs';

// These tests exist because this plugin fails SILENTLY by design. An unknown
// shortcode warns and leaves the text alone rather than throwing, which is
// the right call for prose (see the comment in the plugin) — but it also
// means a regression here ships a page full of literal `:collie-smiling:`
// with nobody noticing. The build stays green either way, so the only thing
// that can catch it is a test.

/** Minimal mdast paragraph tree, the shape remark hands the plugin. */
const para = (...children) => ({
  type: 'root',
  children: [{ type: 'paragraph', children }],
});

const text = (value) => ({ type: 'text', value });

/** Run the plugin and return the resulting paragraph's children. */
function run(tree, filePath = 'test.md') {
  remarkEmotionIcons()(tree, { history: [filePath] });
  return tree.children[0].children;
}

/** Flatten a transformed paragraph back to a single string. */
const flatten = (children) => children.map((c) => c.value).join('');

describe('known shortcodes', () => {
  it('replaces a shortcode with an <img>', () => {
    const out = run(para(text('Excellent :collie-smiling: really')));

    expect(out).toHaveLength(3);
    expect(out[0]).toEqual(text('Excellent '));
    expect(out[1].type).toBe('html');
    expect(out[1].value).toContain('src="/icons/collie-smiling.png"');
    expect(out[2]).toEqual(text(' really'));
  });

  it('carries alt text so screen readers announce the emotion', () => {
    const out = run(para(text(':cockatiel-shocked:')));

    expect(out[0].value).toContain('alt="shocked cockatiel"');
  });

  it('sets intrinsic width/height so the line does not reflow on load', () => {
    const out = run(para(text(':collie-smiling:')));

    expect(out[0].value).toContain('width="128"');
    expect(out[0].value).toContain('height="128"');
  });

  it('handles multiple icons in one paragraph', () => {
    const out = run(para(text('a :collie-smiling: b :collie-sleepy: c')));

    const imgs = out.filter((n) => n.type === 'html');
    expect(imgs).toHaveLength(2);
    expect(imgs[0].value).toContain('collie-smiling.png');
    expect(imgs[1].value).toContain('collie-sleepy.png');
    // The surrounding prose must survive intact, in order.
    expect(out.filter((n) => n.type === 'text').map((n) => n.value)).toEqual(['a ', ' b ', ' c']);
  });

  it('handles two icons with nothing between them', () => {
    const out = run(para(text(':collie-smiling::collie-sleepy:')));

    expect(out.filter((n) => n.type === 'html')).toHaveLength(2);
  });
});

describe('unknown shortcodes', () => {
  it('warns but does not throw, and leaves the text exactly as written', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tree = para(text('a :colie-smiling: b'));

    expect(() => remarkEmotionIcons()(tree, { history: ['typo.md'] })).not.toThrow();
    // Nothing was replaced, so the paragraph is untouched.
    expect(flatten(tree.children[0].children)).toBe('a :colie-smiling: b');
    expect(warn).toHaveBeenCalledOnce();
    // The warning has to name the file, or it's not actionable.
    expect(warn.mock.calls[0][0]).toContain('typo.md');
    expect(warn.mock.calls[0][0]).toContain(':colie-smiling:');

    warn.mockRestore();
  });

  it('keeps valid icons in a paragraph that also contains a typo', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = run(para(text('a :nope-not-real: b :collie-smiling: c')));

    const imgs = out.filter((n) => n.type === 'html');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].value).toContain('collie-smiling.png');
    // The bad shortcode survives as literal text, so it is visible on the page.
    expect(out.map((n) => n.value).join('')).toContain(':nope-not-real:');

    warn.mockRestore();
  });
});

describe('ordinary prose is left alone', () => {
  // The regex requires a leading lowercase letter precisely so these don't
  // match. If that guard regresses, every time and ratio in every review
  // turns into a warning or a broken image.
  it.each([
    ['a time', 'Get there by 12:30 or queue.'],
    ['a ratio', 'About 3:1 chilli to oil.'],
    ['a label', 'note: this is fine'],
    ['a bare colon', 'Two things: heat and salt.'],
    ['an uppercase word', 'See :Collie: nothing happens'],
  ])('leaves %s untouched', (_label, prose) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tree = para(text(prose));
    const before = tree.children[0].children;

    remarkEmotionIcons()(tree, { history: ['prose.md'] });

    // Identity, not just equality — an untouched paragraph should not even
    // be reallocated, which is the fast path the plugin is written for.
    expect(tree.children[0].children).toBe(before);
    expect(flatten(tree.children[0].children)).toBe(prose);
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it('leaves shortcodes inside backticks alone', () => {
    // Backticked text is an `inlineCode` node, not a `text` node, so the
    // plugin never sees it. That's what lets EDITING.md document the syntax.
    const tree = para(
      text('Write '),
      { type: 'inlineCode', value: ':collie-smiling:' },
      text(' to get one.')
    );

    const out = run(tree);

    expect(out).toHaveLength(3);
    expect(out[1]).toEqual({ type: 'inlineCode', value: ':collie-smiling:' });
    expect(out.some((n) => n.type === 'html')).toBe(false);
  });
});

describe('nested nodes', () => {
  it('replaces shortcodes inside emphasis and list items', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'list',
          children: [
            {
              type: 'listItem',
              children: [{ type: 'emphasis', children: [text('good :collie-smiling:')] }],
            },
          ],
        },
      ],
    };

    remarkEmotionIcons()(tree, { history: ['nested.md'] });

    const emphasis = tree.children[0].children[0].children[0];
    expect(emphasis.children.some((n) => n.type === 'html')).toBe(true);
  });
});

describe('regex state', () => {
  it('does not leak lastIndex between paragraphs', () => {
    // SHORTCODE is a module-level /g regex, so a stale lastIndex would make
    // the second paragraph silently skip its icon. Both must transform.
    const tree = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [text('one :collie-smiling:')] },
        { type: 'paragraph', children: [text('two :collie-sleepy:')] },
      ],
    };

    remarkEmotionIcons()(tree, { history: ['two.md'] });

    for (const p of tree.children) {
      expect(p.children.some((n) => n.type === 'html')).toBe(true);
    }
  });
});
