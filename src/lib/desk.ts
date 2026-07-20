import { z } from 'astro:content';

// The shape of a Sunday Table document, as the editor at /desk/ writes it.
//
// WHY THIS IS STORED VERBATIM RATHER THAN CONVERTED
//
// The block vocabulary in blocks.ts describes a review as a stack of known
// shapes. A Sunday Table review isn't that: it's an arranged page — rotated
// photos in the margins, a shape behind a heading, a font picked per
// paragraph. Converting it into blocks means straightening every one of
// those, which publishes a review that is not the one that was written.
//
// So the document is kept exactly as the editor saved it and drawn by
// DeskReview.astro, using the mirrored layout rules in desk-render.mjs.
// Nothing translates, so nothing is lost in translation.
//
// WHAT THIS SCHEMA IS FOR, GIVEN "VERBATIM"
//
// Not to reshape the document — every object below passes unknown keys
// through, so a re-export of the editor that adds a field cannot fail a
// build over a field this site doesn't draw. It exists to catch the
// documents that would render as a blank or broken page: a float with no
// position, a banner pointing at media that isn't there, text that isn't
// text. Those fail the build with a path to the bad value instead of
// publishing a hole.
//
// The frontmatter beside this field is NOT duplication of it. Frontmatter is
// what the site reads (cards, map, search, RSS, structured data); the
// document is what the page draws. They meet only at publish time, where the
// desk's own values are copied out into frontmatter — one direction, so
// there is never a question about which one is right.

const deskMedia = z
  .object({
    // Today this is a data: URI carried inside the document. Publishing to
    // the repo will turn it into a /images/reviews/… path (ROADMAP, stage
    // B); both are strings and both work here, which is why this isn't
    // narrowed to one of them yet.
    src: z.string(),
    label: z.string().optional(),
    ar: z.number().optional(),
    gif: z.boolean().optional(),
    kind: z.string().optional(),
  })
  .passthrough();

const deskTextStyle = z
  .object({
    fontKey: z.string(),
    size: z.number(),
    lh: z.number(),
    color: z.string(),
    bold: z.boolean(),
    italic: z.boolean(),
    align: z.string(),
  })
  .partial()
  .passthrough();

/** The kinds of text the editor's style panel knows about. */
export const DESK_TEXT_TYPES = ['heading', 'subheading', 'body', 'quote', 'caption'] as const;

const deskFlowText = z
  .object({
    id: z.number(),
    kind: z.literal('text'),
    type: z.enum(DESK_TEXT_TYPES),
    // Limited inline HTML (b/i/u/a/br), sanitised again at render time —
    // see sanitizeDeskHtml. Defaulted because an emptied paragraph saves as
    // an absent key, and that is not a reason to fail a build.
    text: z.string().default(''),
    fontKey: z.string().optional(),
    size: z.number().optional(),
    color: z.string().optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    align: z.string().optional(),
    /** Writer-dragged text column width, in px. Absent means full width. */
    w: z.number().optional(),
    /** Writer-dragged left indent, in px. */
    ml: z.number().optional(),
  })
  .passthrough();

const deskFlowBanner = z
  .object({
    id: z.number(),
    kind: z.literal('banner'),
    /** Index into doc.media. */
    media: z.number(),
    h: z.number().optional(),
    radius: z.number().optional(),
    fit: z.enum(['cover', 'contain']).optional(),
    /** Full-bleed: the image runs past the paper's padding on both sides. */
    bleed: z.boolean().optional(),
    alt: z.string().optional(),
  })
  .passthrough();

const deskFloatBase = {
  id: z.number(),
  // What this float is pinned to: a flow block's id, or the header. The
  // editor stores dx/dy RELATIVE to that block, which is what makes a float
  // stay beside its paragraph when the text above it grows.
  anchor: z.union([z.number(), z.literal('$meta')]),
  dx: z.number(),
  dy: z.number(),
  w: z.number(),
  h: z.number(),
  rot: z.number().optional(),
  radius: z.number().optional(),
  /** Sent behind the words rather than sitting over them. */
  behind: z.boolean().optional(),
  /** Marks the verdict sticker, which is why this site has no `reaction`. */
  reaction: z.boolean().optional(),
  lockAspect: z.boolean().optional(),
};

const deskFloatImage = z
  .object({
    ...deskFloatBase,
    kind: z.literal('image'),
    media: z.number(),
    fit: z.enum(['cover', 'contain']).optional(),
    alt: z.string().optional(),
  })
  .passthrough();

const deskFloatShape = z
  .object({
    ...deskFloatBase,
    kind: z.literal('shape'),
    shape: z.enum(['square', 'circle', 'line', 'triangle']),
    color: z.string().optional(),
  })
  .passthrough();

const deskDoc = z
  .object({
    media: z.array(deskMedia).default([]),
    styles: z.record(deskTextStyle).default({}),
    flow: z.array(z.discriminatedUnion('kind', [deskFlowText, deskFlowBanner])).default([]),
    floats: z.array(z.discriminatedUnion('kind', [deskFloatImage, deskFloatShape])).default([]),
    nextId: z.number().optional(),
  })
  .passthrough();

/**
 * The editor's own header values.
 *
 * These overlap the frontmatter (title/name, rating, cuisine, date) and that
 * is deliberate: the page draws the desk's values so it looks like what was
 * arranged, while the site's lists read frontmatter. Two of them can differ
 * in one visible way — the desk keeps half stars (4.5) and the schema keeps
 * whole ones — so a card can show four stars where the page shows four and a
 * half. Flagged in docs/DEVELOPING.md; fixing it is a decision about the
 * star scale, not a bug in either file.
 */
const deskMeta = z
  .object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    cuisine: z.string().optional(),
    location: z.string().optional(),
    rating: z.number().optional(),
    author: z.string().optional(),
    date: z.string().optional(),
    tags: z.string().optional(),
  })
  .passthrough();

export const deskReviewSchema = z
  .object({
    meta: deskMeta.default({}),
    doc: deskDoc,
  })
  .passthrough();

export type DeskReview = z.infer<typeof deskReviewSchema>;
export type DeskDoc = z.infer<typeof deskDoc>;
export type DeskFlowItem = z.infer<typeof deskFlowText> | z.infer<typeof deskFlowBanner>;
export type DeskFloat = z.infer<typeof deskFloatImage> | z.infer<typeof deskFloatShape>;
