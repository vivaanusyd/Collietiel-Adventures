import { z } from 'astro:content';
import { ALIGNMENTS, EMPHASIS, IMAGE_LAYOUTS, TEXT_SIZES } from './block-options.mjs';

// The BLOCK vocabulary — what a writer can put on a review page.
//
// WHY BLOCKS AND NOT A FREEFORM CANVAS
//
// The ask was "put anything anywhere". Every tool that feels freeform —
// Notion, Squarespace, Webflow, Medium — is block-flow underneath, with
// constraints, and that isn't a compromise they settled for. Absolute
// positioning ("this photo at x=340, y=1200") breaks the moment the browser
// is a different width, which is most readers, since most are on phones. It
// also can't survive a reader bumping their font size, and it makes every
// page a bespoke layout that no future restyle can touch.
//
// So writers get: add a block, drag to reorder, set that block's options.
// That delivers the actual want — arrange the page however you like —
// without producing pages that shatter on a phone.
//
// The style options come from ./block-options.mjs; see that file for why
// they're fixed lists rather than a colour picker.
//
// KEEPING THIS IN STEP WITH THE CMS
//
// public/admin/config.yml declares the same blocks and options for the
// editor UI. These two files are the contract: if they disagree, a writer
// saves something that fails the build and cannot fix it themselves.
// test/blocks.test.mjs asserts the two actually match.

// zod needs a non-empty tuple for .enum(), which a plain string[] isn't.
const enumOf = <T extends string>(values: readonly string[]) =>
  z.enum(values as unknown as [T, ...T[]]);

// --- shared field groups -------------------------------------------------

const styleFields = {
  size: enumOf<(typeof TEXT_SIZES)[number]>(TEXT_SIZES).default('normal'),
  align: enumOf<(typeof ALIGNMENTS)[number]>(ALIGNMENTS).default('left'),
  emphasis: enumOf<(typeof EMPHASIS)[number]>(EMPHASIS).default('default'),
};

// Alt text is REQUIRED on every image-bearing block, not optional-with-a-
// nudge. It's what a screen reader announces in place of the picture, and
// "optional but please" reliably produces empty strings. The CMS blocks
// saving without it and says why; this is that same rule at build time, so
// it holds for files written by hand too.
const altText = z
  .string()
  .min(1, 'alt text is required — it is what a screen reader announces instead of the image');

const imageFields = {
  src: z.string().startsWith('/images/'),
  alt: altText,
  caption: z.string().optional(),
};

const hotspot = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  label: z.string().min(1),
});

// --- the blocks ----------------------------------------------------------

const textBlock = z.object({
  type: z.literal('text'),
  /** Markdown. Rendered through the same pipeline as the review body, so
      `:collie-smiling:` emotion icons work inside a text block too. */
  body: z.string(),
  ...styleFields,
});

const imageBlock = z.object({
  type: z.literal('image'),
  ...imageFields,
  layout: enumOf<(typeof IMAGE_LAYOUTS)[number]>(IMAGE_LAYOUTS).default('normal'),
});

const galleryBlock = z.object({
  type: z.literal('gallery'),
  // Two or three. One is just an image block; four or more stops being a row
  // and starts being a grid that would need its own layout rules.
  images: z.array(z.object(imageFields)).min(2).max(3),
});

const annotatedBlock = z.object({
  type: z.literal('annotated'),
  ...imageFields,
  hotspots: z.array(hotspot).min(1),
});

const quoteBlock = z.object({
  type: z.literal('quote'),
  text: z.string().min(1),
  attribution: z.string().optional(),
  align: enumOf<(typeof ALIGNMENTS)[number]>(ALIGNMENTS).default('left'),
});

const dishesBlock = z.object({
  type: z.literal('dishes'),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        // Free text, not a number: "$28", "28", "market price" and "8 ea"
        // are all things a menu actually says. Coercing to a float would
        // either reject the real ones or invent a currency.
        price: z.string().optional(),
        note: z.string().optional(),
      })
    )
    .min(1),
});

/**
 * One review body block.
 *
 * A discriminated union on `type`, so a bad `type` fails the build naming
 * the valid ones, and each block is only checked against its own rules — a
 * gallery isn't asked for a `body`, a text block isn't asked for alt text.
 */
export const blockSchema = z.discriminatedUnion('type', [
  textBlock,
  imageBlock,
  galleryBlock,
  annotatedBlock,
  quoteBlock,
  dishesBlock,
]);

export type Block = z.infer<typeof blockSchema>;
