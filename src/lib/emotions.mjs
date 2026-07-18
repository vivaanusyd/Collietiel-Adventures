// Inline emotion icons — the ones you drop into review prose as
// `:collie-smiling:`. See src/lib/remark-emotion-icons.mjs for the plugin
// that turns that shortcode into an <img>.
//
// Two characters, two emotional registers:
//   cockatiel — the alarmed / unimpressed end (its crest shoots up when
//               startled, lies flat when bored — that's what carries the
//               emotion at icon size)
//   collie    — the happy / eager end
//
// The value is the ALT TEXT: what a screen reader announces in the middle
// of the sentence. Write it as the emotion, not the file name.
//
// To add one: add an entry here AND drop a matching PNG in public/icons/
// with the same name. The plugin checks both at build time.
//
// .mjs (not .ts) on purpose — this file is imported by BOTH the remark
// plugin (plain Node, runs before TS compilation) and Astro components.

export const EMOTIONS = {
  'cockatiel-shocked': 'shocked cockatiel',
  'cockatiel-unimpressed': 'unimpressed cockatiel',
  'cockatiel-suspicious': 'suspicious cockatiel',
  'collie-smiling': 'smiling border collie',
  'collie-delighted': 'delighted border collie',
  'collie-hopeful': 'hopeful border collie',
  'collie-sleepy': 'sleepy, contented border collie',
};

/** Rough guidance — not enforced, just what each one is for. */
export const EMOTION_USAGE = {
  'cockatiel-shocked': 'sticker shock, tiny portions, an absurd bill',
  'cockatiel-unimpressed': 'bland, forgettable, phoned in',
  'cockatiel-suspicious': 'something is off, proceed carefully',
  'collie-smiling': 'this is good, straightforwardly',
  'collie-delighted': 'outstanding, the reason to come here',
  'collie-hopeful': 'would come back, want more of this',
  'collie-sleepy': 'cosy, unhurried, comfortable',
};
