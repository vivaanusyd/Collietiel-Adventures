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
