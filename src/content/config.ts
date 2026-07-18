import { defineCollection, z } from 'astro:content';
import { REACTION_KEYS } from '../lib/reactions';
import { blockSchema } from '../lib/blocks';

// The contract between the WRITING side and the READING side of this site.
// Everything a review needs to be publishable is declared here, and zod
// enforces it at build time — a bad field fails `npm run dev`/`build` with
// a specific message rather than rendering something broken and silent.
const reviews = defineCollection({
  type: 'content',
  schema: z
    .object({
      name: z.string(),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      rating: z.number().int().min(1).max(5),
      date: z.date(),

      // Path into /public, e.g. "/images/reviews/foo.jpg". Kept as a plain
      // string (not Astro's image() helper) because map popups are built by
      // client-side JS, not Astro components — a plain URL is the one thing
      // both sides consume identically.
      //
      // OPTIONAL, because a review genuinely may not have a photo yet — you
      // ate somewhere, you're writing it up, the photo is still on your phone.
      // The cards and the review page both degrade to a text-only layout
      // rather than a broken image (see ReviewCard.astro / [slug].astro). The
      // alternative — a shared stock placeholder — would ship a picture of
      // food nobody served, which is worse than showing no picture.
      cover: z.string().startsWith('/images/').optional(),

      // Teaser for the homepage card, map popup, RSS and the social preview.
      // Capped because a long blurb visibly breaks the card grid — the schema
      // is the cheapest place to catch that, before you see it in the browser.
      //
      // The 20-character floor is enforced at PUBLISH time, not write time
      // (see the superRefine below), so a draft can sit here with no blurb at
      // all instead of a made-up one.
      blurb: z.string().max(160).default(''),

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

      // The review body as ORDERED BLOCKS — what the CMS block editor
      // writes. See src/lib/blocks.ts for the vocabulary and the reasoning.
      //
      // Optional, and it coexists with the Markdown body below the
      // frontmatter rather than replacing it: reviews written by hand in a
      // text editor keep working exactly as before, and a review can use
      // both (Markdown body first, then blocks). Making blocks the only way
      // to write would have broken every existing file and forced anyone
      // comfortable in Markdown through a web UI to change a typo.
      blocks: z.array(blockSchema).optional(),
    })
    // Cross-field rules. These can't live on an individual field because
    // they depend on `draft` — which is the point: a draft is allowed to be
    // incomplete, a published review is not.
    .superRefine((data, ctx) => {
      // A blurb under 20 characters says nothing useful, and this text is
      // load-bearing in four places at once: the homepage card, the map
      // popup, the RSS entry and the social preview. So it's still required
      // to publish — but only to PUBLISH. Enforcing it on drafts would mean
      // every unwritten review needed 20 characters of invented teaser just
      // to keep the build green, and invented text has a way of surviving
      // to production.
      if (!data.draft && data.blurb.trim().length < 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['blurb'],
          message:
            `blurb must be at least 20 characters to publish (got ${data.blurb.trim().length}). ` +
            `Either write one, or set \`draft: true\` while you finish it.`,
        });
      }

      // Hotspots are positioned as percentages of the cover photo, so
      // without a cover there is nothing for them to be a percentage OF.
      // They'd silently vanish rather than error, which is the kind of
      // quiet nothing this schema exists to prevent.
      if (data.hotspots?.length && !data.cover) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['hotspots'],
          message: 'hotspots need a `cover` photo to be pinned to — add one, or remove them.',
        });
      }
    }),
});

export const collections = { reviews };
