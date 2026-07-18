# Adding a review

Full instructions — frontmatter reference, animal reaction list, draft
workflow, pre-publish checklist — live in **[EDITING.md](../../../EDITING.md)**
at the project root.

Short version: drop a new `.md` file in this folder. The filename becomes
the URL slug (`bang-bang-noodles.md` → `/reviews/bang-bang-noodles`), and
the homepage card, map pin, review page, RSS entry and sitemap entry all
appear on their own — no registration step, no pin list to update.

```yaml
---
name: "Bang Bang Noodles"
lat: -33.8908
lng: 151.1957
rating: 4
date: 2026-02-10
cover: "/images/reviews/bang-bang-noodles.jpg"
blurb: "Numbing, tangy, and gone in about ten minutes flat."
reaction: fox
---
```

Then write the review as normal Markdown below the frontmatter.

Get `lat`/`lng` by right-clicking a spot on openstreetmap.org → "Show
address", or Google Maps → right-click → the numbers at the top.

This file is underscore-prefixed so Astro's content loader ignores it
instead of trying to parse it as a review.
