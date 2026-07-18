import { describe, expect, it } from 'vitest';
import { escapeXml } from '../src/lib/xml';

// The feed is hand-rolled, so escaping is the one place a bad character in a
// restaurant name can produce XML that no feed reader will parse. The
// double-escaping case below is the specific bug the single-pass regex
// exists to prevent, and it's invisible without a test: a doubly-escaped
// feed still parses, it just renders "&amp;" as literal text to readers.

describe('escapeXml', () => {
  it('escapes all five XML predefined entities', () => {
    expect(escapeXml('&')).toBe('&amp;');
    expect(escapeXml('<')).toBe('&lt;');
    expect(escapeXml('>')).toBe('&gt;');
    expect(escapeXml('"')).toBe('&quot;');
    expect(escapeXml("'")).toBe('&apos;');
  });

  it('does not double-escape an ampersand', () => {
    // The regression guard. A .replace('&','&amp;').replace('<','&lt;')
    // chain passes the test above and fails this one.
    expect(escapeXml('Fish & Chips')).toBe('Fish &amp; Chips');
    expect(escapeXml('Fish & Chips')).not.toContain('&amp;amp;');
  });

  it('does not re-escape already-escaped input', () => {
    // Escaping twice must visibly differ from escaping once, so that if this
    // is ever called on already-escaped text the bug is loud, not silent.
    const once = escapeXml('a & b');
    expect(escapeXml(once)).toBe('a &amp;amp; b');
  });

  it('handles several entities in one string', () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;'
    );
  });

  it('escapes a run of ampersands', () => {
    expect(escapeXml('&&&')).toBe('&amp;&amp;&amp;');
  });

  it('leaves ordinary prose untouched', () => {
    const prose = 'Numbing, tangy, and gone in about ten minutes flat.';
    expect(escapeXml(prose)).toBe(prose);
  });

  it('leaves non-ASCII and emoji untouched', () => {
    // Restaurant names carry accents and the feed is UTF-8, so these must
    // pass through as themselves rather than becoming numeric references.
    expect(escapeXml('Green Fig Café')).toBe('Green Fig Café');
    expect(escapeXml('mápó tofu 🍜')).toBe('mápó tofu 🍜');
  });

  it('returns an empty string unchanged', () => {
    expect(escapeXml('')).toBe('');
  });
});
