// The per-review VERDICT BADGE — exactly one per review, set in frontmatter
// as `reaction:`, shown on the homepage card and the review page.
//
// Not to be confused with the INLINE EMOTION ICONS (src/lib/emotions.mjs),
// which are the cockatiels and collies you sprinkle through the prose as
// `:collie-smiling:`. Different jobs:
//   reaction  → one per review, the at-a-glance summary on a card
//   :emotion: → many per review, punctuation inside a sentence
//
// One source of truth, used in three places:
//   1. src/content/config.ts turns these keys into a zod enum, so a typo in
//      frontmatter (`reaction: dog`) fails the build with the valid list.
//   2. ReviewCard / [slug].astro render the icon + its label.
//   3. public/icons/<key>.png is the artwork.
//
// To add a reaction: add an entry here AND drop a matching PNG in
// public/icons/. Those two steps are the whole job.

export const REACTIONS = {
  pig: 'Go hungry',
  bear: 'Huge portions',
  bee: 'Sweet tooth territory',
  crab: 'Seafood done right',
  owl: 'Open late',
  cat: 'Cosy, lingerable',
  fox: 'Clever cooking',
  snail: 'Take your time',
} as const;

export type ReactionKey = keyof typeof REACTIONS;

// zod's .enum() needs a non-empty tuple, not a plain string[].
export const REACTION_KEYS = Object.keys(REACTIONS) as [ReactionKey, ...ReactionKey[]];

export function reactionLabel(key: ReactionKey): string {
  return REACTIONS[key];
}
