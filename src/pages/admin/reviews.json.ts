import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// Feeds the canvas editor at /admin/arrange.
//
// Includes DRAFTS, which every other endpoint on this site deliberately
// excludes — arranging a review before it's published is the main thing the
// editor is for. That's not a leak: these files are already readable in the
// public repository, so this exposes nothing that wasn't public. It's the
// one place `getCollection` is called directly rather than through
// getPublishedReviews(), and this comment is why.
//
// Read-only. Saving goes back through the GitHub API from the browser,
// authenticated as the writer — see the editor page.

export const GET: APIRoute = async () => {
  const reviews = await getCollection('reviews');

  const payload = reviews
    .map((r) => ({
      slug: r.slug,
      name: r.data.name,
      draft: r.data.draft,
      cover: r.data.cover ?? null,
      blocks: r.data.blocks ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Never cached: the editor must see what was just saved, not a copy
      // from before the last deploy.
      'Cache-Control': 'no-store',
    },
  });
};
