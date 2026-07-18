# Reviews live here

Most reviews arrive through the editor at `/admin/`, which writes files into
this folder on a writer's behalf. You can also add one by hand.

- **Writing a review:** [EDITING.md](../../../EDITING.md) — the editor, in
  plain language
- **Frontmatter reference and schema rules:**
  [docs/DEVELOPING.md](../../../docs/DEVELOPING.md)

Short version for a file written by hand: drop a `.md` file in this folder.
The filename becomes the URL slug (`bang-bang-noodles.md` →
`/reviews/bang-bang-noodles`), and the homepage card, map pin, review page,
cuisine page, RSS entry and sitemap entry all appear on their own — no
registration step, no list to update.

```yaml
---
name: 'Bang Bang Noodles'
lat: -33.8908
lng: 151.1957
rating: 4
date: 2026-02-10
blurb: 'Numbing, tangy, and gone in about ten minutes flat.'
reaction: fox
cuisine: 'Sichuan'
---

Then write the review as normal Markdown below the frontmatter.
```

Get `lat`/`lng` by right-clicking a spot on openstreetmap.org → "Show
address", or Google Maps → right-click → the numbers at the top. (The editor
does this with a map picker, which is why nobody using it types a
coordinate.)

Reviews written in the editor use a `blocks:` list instead of a Markdown
body. Both work, and a review can use both — see
[docs/DEVELOPING.md](../../../docs/DEVELOPING.md).

This file is underscore-prefixed so Astro's content loader ignores it
instead of trying to parse it as a review.
