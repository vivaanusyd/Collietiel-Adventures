import { describe, expect, it } from 'vitest';
import { normalize, scoreEntry, searchEntries, terms } from '../src/lib/search.mjs';

// Search relevance fails silently. A scoring bug doesn't throw, doesn't
// fail the build, and doesn't look broken — the results are just subtly
// wrong, and the only person who notices is a reader who doesn't find what
// they wanted and concludes it isn't there. Same reason the emotion-icon
// plugin and the RSS escaper are tested.

const entry = (over = {}) => ({
  slug: 'x',
  name: 'Bang Bang Noodles',
  cuisine: 'Sichuan',
  address: '12 King St, Newtown NSW',
  blurb: 'Numbing, tangy, and gone in ten minutes.',
  rating: 4,
  ...over,
});

const CORPUS = [
  entry({ slug: 'bang', name: 'Bang Bang Noodles', cuisine: 'Sichuan', rating: 4 }),
  entry({
    slug: 'fig',
    name: 'Green Fig Café',
    cuisine: 'Café',
    address: '45 Enmore Rd, Enmore NSW',
    blurb: 'Best brunch in the inner west.',
    rating: 5,
  }),
  entry({
    slug: 'oysters',
    name: 'Harbourside Oysters',
    cuisine: 'Seafood',
    address: '8 Circular Quay W, Sydney NSW',
    blurb: 'Pricey, but the view holds up.',
    rating: 4,
  }),
];

describe('normalize', () => {
  it('folds case and accents so "cafe" finds "Café"', () => {
    expect(normalize('Café')).toBe('cafe');
    expect(normalize('CAFÉ')).toBe('cafe');
  });

  it('survives null and undefined fields', () => {
    // cuisine and address are optional in the schema, so these reach here.
    expect(normalize(undefined)).toBe('');
    expect(normalize(null)).toBe('');
  });
});

describe('terms', () => {
  it('splits on whitespace and drops empties', () => {
    expect(terms('  sichuan   newtown ')).toEqual(['sichuan', 'newtown']);
  });

  it('returns nothing for an empty query', () => {
    expect(terms('')).toEqual([]);
    expect(terms('   ')).toEqual([]);
  });
});

describe('scoreEntry field weighting', () => {
  it('ranks a name prefix above a mid-name match', () => {
    const prefix = scoreEntry(entry({ name: 'Bang Bang Noodles' }), ['bang']);
    const middle = scoreEntry(entry({ name: 'The Bang Shop' }), ['bang']);
    expect(prefix).toBeGreaterThan(middle);
  });

  it('ranks name above cuisine above address above blurb', () => {
    const byName = scoreEntry(entry({ name: 'Oyster Bar' }), ['oyster']);
    const byCuisine = scoreEntry(entry({ name: 'X', cuisine: 'Oyster' }), ['oyster']);
    const byAddress = scoreEntry(entry({ name: 'X', cuisine: 'Y', address: 'Oyster Lane' }), [
      'oyster',
    ]);
    const byBlurb = scoreEntry(
      entry({ name: 'X', cuisine: 'Y', address: 'Z', blurb: 'great oyster' }),
      ['oyster']
    );

    expect(byName).toBeGreaterThan(byCuisine);
    expect(byCuisine).toBeGreaterThan(byAddress);
    expect(byAddress).toBeGreaterThan(byBlurb);
    expect(byBlurb).toBeGreaterThan(0);
  });

  it('scores each field once, not once per field it appears in', () => {
    // "Sichuan" in both name and cuisine should take the name score, not
    // the sum — otherwise an entry repeating a word everywhere dominates.
    const both = scoreEntry(entry({ name: 'Sichuan House', cuisine: 'Sichuan' }), ['sichuan']);
    const nameOnly = scoreEntry(entry({ name: 'Sichuan House', cuisine: 'Thai' }), ['sichuan']);
    expect(both).toBe(nameOnly);
  });
});

describe('scoreEntry requires every term to match', () => {
  it('rejects an entry matching only some terms', () => {
    // The important one. Without this rule "sichuan newtown" returns every
    // Sichuan place in the city and the second word silently does nothing
    // — worse than no results, because it looks like it worked.
    const e = entry({ name: 'Bang Bang Noodles', cuisine: 'Sichuan', address: 'Newtown' });
    expect(scoreEntry(e, ['sichuan', 'newtown'])).toBeGreaterThan(0);
    expect(scoreEntry(e, ['sichuan', 'bondi'])).toBe(0);
  });

  it('returns 0 for no terms', () => {
    expect(scoreEntry(entry(), [])).toBe(0);
  });
});

describe('searchEntries', () => {
  it('returns nothing for an empty query rather than everything', () => {
    // An empty search showing the entire corpus reads as broken.
    expect(searchEntries(CORPUS, '')).toEqual([]);
    expect(searchEntries(CORPUS, '   ')).toEqual([]);
  });

  it('finds by name', () => {
    expect(searchEntries(CORPUS, 'bang').map((e) => e.slug)).toEqual(['bang']);
  });

  it('finds by cuisine', () => {
    expect(searchEntries(CORPUS, 'seafood').map((e) => e.slug)).toEqual(['oysters']);
  });

  it('finds by suburb', () => {
    expect(searchEntries(CORPUS, 'enmore').map((e) => e.slug)).toEqual(['fig']);
  });

  it('finds an accented name from an unaccented query', () => {
    expect(searchEntries(CORPUS, 'cafe').map((e) => e.slug)).toEqual(['fig']);
  });

  it('is case-insensitive', () => {
    expect(searchEntries(CORPUS, 'BANG').map((e) => e.slug)).toEqual(['bang']);
  });

  it('returns nothing for a term nothing matches', () => {
    expect(searchEntries(CORPUS, 'sushi')).toEqual([]);
  });

  it('breaks score ties by rating', () => {
    const tied = [
      entry({ slug: 'low', name: 'Test Kitchen', rating: 2 }),
      entry({ slug: 'high', name: 'Test Kitchen', rating: 5 }),
    ];
    expect(searchEntries(tied, 'test').map((e) => e.slug)).toEqual(['high', 'low']);
  });

  it('narrows rather than widens as terms are added', () => {
    // Adding a word should never return MORE results — the property that
    // makes multi-word search feel like it's doing something.
    const one = searchEntries(CORPUS, 'sichuan').length;
    const two = searchEntries(CORPUS, 'sichuan newtown').length;
    const three = searchEntries(CORPUS, 'sichuan newtown noodles').length;
    expect(two).toBeLessThanOrEqual(one);
    expect(three).toBeLessThanOrEqual(two);
  });
});
