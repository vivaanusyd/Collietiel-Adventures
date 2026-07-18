// The styling vocabulary a writer can choose from, and the list of block
// types the editor offers.
//
// .mjs (not .ts) on purpose, for the same reason as src/lib/emotions.mjs:
// this file is imported by BOTH Astro code (src/lib/blocks.ts builds the
// zod schema from it) and plain Node (test/blocks.test.mjs cross-checks it
// against public/admin/config.yml, and that test can't import anything that
// touches `astro:content`).
//
// WHY THESE ARE FIXED LISTS RATHER THAN A COLOUR PICKER AND A FONT DROPDOWN
//
// Arbitrary per-element colour and type is the reason CMS-driven sites decay.
// Every writer makes a locally reasonable choice; the choices collectively
// destroy the design; and it becomes unfixable because the values are baked
// into hundreds of content files instead of one stylesheet. Every option
// below resolves to a CSS custom property or a type-scale step in
// src/styles/global.css, so a redesign stays a stylesheet edit — change the
// variable and every review follows.

/** Type-scale steps. Map to --type-* in global.css. */
export const TEXT_SIZES = ['small', 'normal', 'large', 'display'];

/** No `justify`: justified text in a narrow phone column produces rivers. */
export const ALIGNMENTS = ['left', 'center'];

/** Palette slots, not colours — these name CSS variables. */
export const EMPHASIS = ['default', 'accent', 'muted'];

/** How wide an image sits relative to the prose column. */
export const IMAGE_LAYOUTS = ['full', 'wide', 'normal', 'inset', 'left', 'right'];

/** Every block type the editor offers. */
export const BLOCK_TYPES = ['text', 'image', 'gallery', 'annotated', 'quote', 'dishes'];

// --- the layout grid -----------------------------------------------------
//
// How "put anything anywhere" works without shattering on a phone.
//
// A block can carry an optional `layout` giving its position as GRID
// COORDINATES — a column to start at, a column to end at, and a row. Not
// pixels. This is the model Squarespace's Fluid Engine uses, and the reason
// it can offer a genuine drag-anywhere canvas that still reflows: a
// coordinate on a 24-column grid means the same thing at any screen width,
// where "x: 340px" does not.
//
// Two grids, stored independently, because that's the honest cost of the
// feature: a layout that reads well across three desktop columns has to be
// re-thought for a phone, and no algorithm can guess the intent. The mobile
// layout is DERIVED automatically (top-to-bottom, full width) unless a
// writer overrides it, so the common case needs no second pass.
//
// Rows use `minmax(row-height, auto)`, so a block whose text wraps longer
// than expected pushes the grid down instead of overlapping its neighbour.
// That's what makes this safe without JavaScript measuring anything.

/** Columns on the desktop canvas. 24 divides by 2, 3, 4, 6, 8 and 12 — so
    halves, thirds and quarters all land on exact column boundaries. */
export const GRID_COLUMNS = 24;

/** Columns on the phone canvas. 8 is enough to offset and inset something
    without pretending a 380px screen supports a three-column layout. */
export const GRID_COLUMNS_MOBILE = 8;

/** Height of one grid row, in CSS pixels. Rows grow past this as needed. */
export const GRID_ROW_HEIGHT = 24;
