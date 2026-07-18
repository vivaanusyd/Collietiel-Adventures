import { z } from 'astro:content';
import { ALIGNMENTS, EMPHASIS, GRID_COLUMNS, IMAGE_LAYOUTS, TEXT_SIZES } from './block-options.mjs';

// The BLOCK vocabulary — what a writer can put on a review page.
//
// HOW "PUT ANYTHING ANYWHERE" WORKS HERE
//
// A block can either FLOW (stacked in order, the default and what the CMS
// writes) or be PLACED on a grid via the optional `layout` field, which the
// canvas editor at /admin/arrange writes when you drag something.
//
// Placement is grid COORDINATES, never pixels. "x: 340px" means a different
// thing on every screen and nothing at all when a reader bumps their font
// size; "columns 4 through 12" means the same thing everywhere. That's the
// model Squarespace's Fluid Engine uses, and it's what makes a genuine
// drag-anywhere canvas — including overlap — survive a phone.
//
// The honest cost is two layouts: an arrangement that reads well across a
// wide canvas has to be reconsidered narrow, and no algorithm can guess the
// intent. Mobile is DERIVED (full-width stack, desktop reading order) unless
// a writer deliberately arranges it, so the common case needs no second pass.
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

// Optional grid placement, written by the canvas editor at /admin/arrange.
//
// A block WITHOUT this flows normally, stacked in order — which is what the
// CMS's block list produces and what every existing review uses. A block
// WITH it is placed on the grid. The two coexist on one page: flowed blocks
// come first, positioned ones sit in a grid below.
//
// See block-options.mjs for why this is coordinates rather than pixels.
const placement = z.object({
  /** 1-based first column, inclusive. */
  col: z.number().int().min(1).max(GRID_COLUMNS),
  /** 1-based last column, inclusive. Must be >= col (checked below). */
  colEnd: z.number().int().min(1).max(GRID_COLUMNS),
  /** 1-based row. Rows grow to fit their content. */
  row: z.number().int().min(1),
  /** How many rows tall. */
  rowSpan: z.number().int().min(1).default(4),
  /** Stacking order when blocks overlap. Higher sits on top. */
  z: z.number().int().min(0).max(99).default(0),
});

const layout = z
  .object({
    desktop: placement,
    // Omitted in the common case: the renderer derives a full-width stack
    // in desktop reading order, which is right for most layouts. Present
    // only when a writer has deliberately arranged the phone view.
    mobile: placement.optional(),
  })
  .superRefine((data, ctx) => {
    for (const [key, place] of Object.entries(data)) {
      if (place && place.colEnd < place.col) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key, 'colEnd'],
          message: `colEnd (${place.colEnd}) is before col (${place.col}) — the block would have negative width.`,
        });
      }
    }
  });

// Every block accepts an optional grid placement. Spread into each variant
// rather than wrapped around the union, because a discriminated union needs
// its members to stay plain objects for zod to narrow on `type`.
//
// Declared HERE, after `layout` — `const` isn't hoisted, so defining this
// above `layout` throws at module load rather than failing a type check.
const layoutField = { layout: layout.optional() };

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
  ...layoutField,
});

const imageBlock = z.object({
  type: z.literal('image'),
  ...imageFields,
  // NOTE: `width` not `layout` — `layout` is the grid placement above, and
  // two fields with that name on one block would be genuinely confusing.
  width: enumOf<(typeof IMAGE_LAYOUTS)[number]>(IMAGE_LAYOUTS).default('normal'),
  ...layoutField,
});

const galleryBlock = z.object({
  type: z.literal('gallery'),
  // Two or three. One is just an image block; four or more stops being a row
  // and starts being a grid that would need its own layout rules.
  images: z.array(z.object(imageFields)).min(2).max(3),
  ...layoutField,
});

const annotatedBlock = z.object({
  type: z.literal('annotated'),
  ...imageFields,
  hotspots: z.array(hotspot).min(1),
  ...layoutField,
});

const quoteBlock = z.object({
  type: z.literal('quote'),
  text: z.string().min(1),
  attribution: z.string().optional(),
  align: enumOf<(typeof ALIGNMENTS)[number]>(ALIGNMENTS).default('left'),
  ...layoutField,
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
  ...layoutField,
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
