// Ranking for the client-side search on /search.
//
// Extracted from the page so it can be unit-tested. Search relevance is a
// classic silent failure: a scoring bug doesn't throw, doesn't fail the
// build, and doesn't look broken — the results are just subtly wrong, and
// the only person who finds out is a reader who doesn't find what they
// wanted and assumes it isn't there.
//
// .mjs so both the browser bundle and a plain-Node test can import it.

/**
 * Field weights, in the order people actually search a review site: they
 * remember the restaurant's name, then roughly what kind of food it was,
 * then vaguely where it was. The blurb is last because matching prose is
 * the weakest signal of intent.
 */
const WEIGHTS = {
  namePrefix: 100,
  name: 60,
  cuisine: 40,
  address: 25,
  blurb: 10,
};

/** Fold case and accents so "cafe" finds "Café". */
export function normalize(text) {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Split a query into search terms. */
export function terms(query) {
  return normalize(query).split(/\s+/).filter(Boolean);
}

/**
 * Score one entry against a list of terms. Returns 0 for "not a result".
 *
 * EVERY term must match something. Without that rule, searching
 * "sichuan newtown" returns every Sichuan restaurant in the city — the
 * second word silently does nothing, which is worse than no results,
 * because it looks like it worked.
 */
export function scoreEntry(entry, queryTerms) {
  if (queryTerms.length === 0) return 0;

  const name = normalize(entry.name);
  const cuisine = normalize(entry.cuisine);
  const address = normalize(entry.address);
  const blurb = normalize(entry.blurb);

  let total = 0;

  for (const term of queryTerms) {
    let best = 0;

    // A prefix match on the name beats one buried mid-string, so "bang"
    // puts "Bang Bang Noodles" above something whose blurb says "banging".
    if (name.startsWith(term)) best = WEIGHTS.namePrefix;
    else if (name.includes(term)) best = WEIGHTS.name;
    else if (cuisine.includes(term)) best = WEIGHTS.cuisine;
    else if (address.includes(term)) best = WEIGHTS.address;
    else if (blurb.includes(term)) best = WEIGHTS.blurb;

    if (best === 0) return 0;
    total += best;
  }

  return total;
}

/**
 * Matching entries, best first; ties broken by rating then name.
 *
 * Generic via JSDoc so TypeScript callers get their own entry type back
 * rather than `any[]` — this module is .mjs (see the note at the top), and
 * without this the search page would need a cast that could silently go
 * stale if the index shape changed.
 *
 * @template {{ name: string, rating: number }} T
 * @param {T[]} entries
 * @param {string} query
 * @returns {T[]}
 */
export function searchEntries(entries, query) {
  const queryTerms = terms(query);
  if (queryTerms.length === 0) return [];

  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, queryTerms) }))
    .filter((m) => m.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.entry.rating - a.entry.rating ||
        a.entry.name.localeCompare(b.entry.name)
    )
    .map((m) => m.entry);
}
