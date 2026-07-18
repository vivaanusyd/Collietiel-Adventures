# Cover photos and in-review images

Uploads from the CMS media picker land here, and `cover:` paths in review
frontmatter point at them (`/images/reviews/<file>`).

The folder is tracked-but-empty on purpose. It held four generated
placeholder covers for restaurants nobody had actually photographed; those
were removed rather than kept as filler, because a stock photo of food that
wasn't served is worse than showing no photo at all.

`cover` is optional in the schema, so a review with no photo yet renders a
text-only card and a review page that opens on its heading. See
`src/content/config.ts`.
