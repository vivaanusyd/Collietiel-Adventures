import { defineCollection, z } from 'astro:content';
import { REACTION_KEYS } from '../lib/reactions';

// The contract between the WRITING side and the READING side of this site.
// Everything a review needs to be publishable is declared here, and zod
// enforces it at build time — a bad field fails `npm run dev`/`build` with
// a specific message rather than rendering something broken and silent.
const reviews = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    rating: z.number().int().min(1).max(5),
    date: z.date(),

    // Path into /public, e.g. "/images/reviews/foo.jpg". Kept as a plain
    // string (not Astro's image() helper) because map popups are built by
    // client-side JS, not Astro components — a plain URL is the one thing
    // both sides consume identically.
    cover: z.string().startsWith('/images/'),

    // Teaser for the homepage card, map popup, RSS and the social preview.
    // Capped because a long blurb visibly breaks the card grid — the schema
    // is the cheapest place to catch that, before you see it in the browser.
    blurb: z.string().min(20).max(160),

    // Which animal sits on the card. Validated against src/lib/reactions.ts,
    // so `reaction: dog` fails the build and lists the valid options.
    reaction: z.enum(REACTION_KEYS),

    // --- editorial workflow fields ---
    // draft: true  → visible in `npm run dev`, stripped from `npm run build`.
    // This is the "not finished yet" switch. See src/lib/reviews.ts.
    draft: z.boolean().default(false),
    author: z.string().default('Vivaan'),
    // Set when you materially revise an already-published review. Readers
    // see "Updated <date>"; leaving it off means the review stands as first
    // published.
    updated: z.date().optional(),

    cuisine: z.string().optional(),
    address: z.string().optional(),
    // Alt text for the cover photo. Optional, falls back to the venue name,
    // but write a real one — it's what screen readers announce.
    coverAlt: z.string().optional(),

    // Optional dish call-outs pinned to the cover photo. Omit this and the
    // cover renders as a plain captioned image — which is the right default,
    // since most photos have nothing worth annotating and a hotspot with
    // nothing to say is just clutter.
    //
    // x/y are percentages from the top-left of the photo, so they survive
    // the image being resized or cropped by object-fit.
    hotspots: z
      .array(
        z.object({
          x: z.number().min(0).max(100),
          y: z.number().min(0).max(100),
          label: z.string().min(1),
        })
      )
      .optional(),
  }),
});

export const collections = { reviews };
