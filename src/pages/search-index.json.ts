import type { APIRoute } from 'astro';
import { getPublishedReviews, starString } from '../lib/reviews';
import { imageUrl } from '../lib/images.mjs';

// A prebuilt search index, fetched by /search on first keystroke.
//
// WHY A SEPARATE FILE AND NOT INLINE ON THE PAGE
//
// Inlining would put the whole corpus in the HTML of a page most readers
// never use, on every visit. As a separate JSON file it's fetched once, on
// demand, and cached by the browser afterwards.
//
// WHY NO SEARCH LIBRARY
//
// Lunr/Fuse/Pagefind are all real answers at a few thousand documents. At
// the scale of one person's restaurant reviews, the index is small enough
// to scan directly, and matching on name/cuisine/blurb is what people
// actually search for on a review site — nobody is full-texting the prose
// for a phrase. A dependency here would cost more bytes than the corpus.
//
// Revisit if this passes a few hundred reviews: the honest signal is the
// index file getting large enough to notice, not a number decided now.

export const GET: APIRoute = async () => {
  const reviews = await getPublishedReviews();

  const index = reviews.map((r) => ({
    slug: r.slug,
    name: r.data.name,
    cuisine: r.data.cuisine ?? '',
    address: r.data.address ?? '',
    blurb: r.data.blurb,
    stars: starString(r.data.rating),
    rating: r.data.rating,
    // 400px is the card size in the results list — no reason to hand the
    // search page a 2000px hero for a thumbnail.
    cover: r.data.cover ? imageUrl(r.data.cover, 400) : null,
  }));

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Content-addressed by deploy: a new build replaces the file, so a
      // long cache would serve a stale index. An hour is short enough that
      // a new review shows up soon and long enough to not refetch per visit.
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
