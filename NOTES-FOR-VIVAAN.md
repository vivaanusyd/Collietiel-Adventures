# Notes

What changed, what you still have to do, and what I didn't build.

**The one thing to do first:** the editor at `/admin/` will load but can't
sign anyone in until you create a GitHub OAuth app and paste two values into
Netlify. That's [Part 1 of the setup
checklist](docs/SETUP-CHECKLIST.md#part-1--make-the-editor-work-required),
about 10 minutes. Everything else on the site works right now.

---

## 1. What I did, commit by commit

Every commit passed `npm test` — build, `sitetest.py`, and unit tests —
before it was made.

**`ac31665` Set site URL, name the site, fix RSS and heading structure**
Your uncommitted work, committed as-is and first, so it's separable from
everything I did after.

**`92a7287` Prettier, Vitest, and `npm test`**
One command that gates everything: build + `sitetest.py` + unit tests.
Prettier is scoped to code only — Markdown is excluded because
`src/content/reviews/*.md` is writers' content, and a dev tool reformatting
it would put changes in a writer's pull request that they didn't make and
can't explain.

**`84b69de` Unit-test the two functions that fail silently**
The emotion-icon plugin warns instead of throwing on a typo'd shortcode, and
the RSS escaper's double-escaping bug still produces a feed that parses.
Neither turns the build red, so tests are the only thing that catches a
regression. 23 tests.

**`0719f11` Remove all invented review content; make `cover` optional**
Detail below in §4.

**`5443c0f` The block editor's data model and renderer**
Six block types (text, image, gallery, annotated photo, pull quote, dish
list), each with per-block settings. Reasoning for blocks-not-canvas is in
`src/lib/blocks.ts` and summarised in §5.

This also fixed a real latent bug: `icons.mjs` and the remark plugin each
resolved `public/icons/` relative to their own file, which is correct from
source but wrong from bundled build output — rendering a text block reported
every icon as missing. There's now one lookup that tries both.

**`429692c` The writer-facing CMS at `/admin/`**
Sveltia CMS, GitHub sign-in, editorial workflow. Detail in §5.

**`dc51519` Structured data, cuisine pages, `/about`, pagination**
JSON-LD `Review` + `Restaurant` on every review page — the highest-value SEO
change available, and it needed no new fields. `/cuisine/<slug>` pages.
`/about` as structure only (§6). Homepage pagination past 12.

**`9ac53cb` Dark mode, reduced motion, image existence check**
Dark mode follows the OS setting, implemented purely by redeclaring the
palette — which only worked because `.review-card`'s hardcoded `#fff` was
the last literal colour. A missing image file now fails the build naming the
path; `public/` bypasses Vite, so nothing checked before and a typo'd
filename shipped a broken image.

**`6942e99` CI on every pull request**
Matters more than usual now: writers submit PRs and most will never run a
build locally. Runs exactly `npm test`, so a green tick means the same thing
as a green run on your laptop.

**`c02f7fd` Rewrite the docs**
`EDITING.md` for someone who will never see the code; developer material to
`docs/DEVELOPING.md`; `docs/SETUP-CHECKLIST.md` for the dashboard steps.

---

## 2. Everything you still have to do, in order

Full detail with exact values in **[docs/SETUP-CHECKLIST.md](docs/SETUP-CHECKLIST.md)**.
Summary:

1. **Create a GitHub OAuth app** at
   <https://github.com/settings/developers>. Callback URL must be exactly
   `https://collietiel-adventures.netlify.app/api/callback` — a mismatch here
   is the most common failure and GitHub's error doesn't say which character
   is wrong.
2. **Copy the Client ID and generate a client secret.** The secret is shown
   once.
3. **Paste both into Netlify** → Site configuration → Environment variables,
   as `GITHUB_OAUTH_ID` and `GITHUB_OAUTH_SECRET`. Exact spellings — the code
   looks for those names.
4. **Trigger a redeploy.** Environment variables are read at build time; the
   editor keeps failing until you do this.
5. **Test it:** go to `/admin/`, sign in, confirm you see the Reviews
   collection.
6. *(Optional)* **Google Search Console** — verify the domain, submit
   `sitemap.xml`.

Steps 1–4 are required. Nothing else on the site depends on them.

**Do not put those two values in the repo.** A secret in Git is a secret
published — the repository is readable, and Git remembers it after a later
commit removes it.

---

## 3. How to add a writer, start to finish

1. <https://github.com/vivaanusyd/Collietiel-Adventures/settings/access> →
   **Add people** → their GitHub username.
2. Role **Write**. (Write = can submit for your approval. Admin = can
   publish. Writers get Write.)
3. They accept the emailed invite.
4. Send them the link to `/admin/` and to
   **[EDITING.md](EDITING.md)**.

That's the whole thing — there's no separate account. **To remove someone,**
remove them from that same page; access ends immediately and their published
work stays.

**Why there's no password on the editor.** A static site has no server to
check a password against, so any password checked in the page ships its own
answer to the browser in plain text — view-source defeats it. That's not
weak security, it's decorative, and worse than nothing because it looks like
protection. Sign-in goes to GitHub instead, the check happens on their
servers against real accounts, and access lives in one list you control.

A writer with Write access **cannot** publish to the live site. Their work
always arrives as a pull request. That's enforced by GitHub permissions, not
by anything in the page.

---

## 4. The content situation

All four reviews are now **empty and marked draft**. I removed the
placeholder prose and the invented detail about oysters, noodles and brunch,
and deleted the four generated cover images.

**Kept:** name, address, coordinates, cuisine, rating — those are real and
worth not re-typing.

**On the blurbs, you asked which I'd choose:** I relaxed the constraint
rather than inserting a `NEEDS BLURB` placeholder. The 20-character minimum
now applies **at publish time only** — a draft can have no blurb at all, and
publishing without one fails the build with a message telling you what to
do. A sentinel string is still text that can ship; this can't. Trying to
publish an empty review gives you:

```
blurb must be at least 20 characters to publish (got 0).
Either write one, or set `draft: true` while you finish it.
```

**On the covers, I took your preferred option:** `cover` is now optional
rather than pointing at a shared placeholder. A review genuinely may not
have a photo yet, and a stock photo of food nobody served is worse than no
photo. Cards without one keep their shape so the grid doesn't go ragged.

**Net result:** the site builds, deploys and works, with zero invented
content. The homepage currently says there are no reviews yet, which is
true.

---

## 5. On the editor — two things fall short

Both are blocked on the same upstream gap, and I'd rather flag them than
quietly pretend otherwise.

**Sveltia's custom widget API (`registerFieldType`) is documented but not
implemented yet** — it's on their 1.0 milestone. That means:

- **The verdict badge is a text dropdown, not a grid of the animal
  pictures.** You asked for pictures and you're right. What I could do is
  make sure a writer never sees a raw key like `fox` — every option reads
  "🦊 Fox — clever cooking".
- **Hotspots are x/y percentage inputs, not click-to-place on the photo.**
  The preview pane shows where the dot lands, so it's adjust-and-look rather
  than pure guesswork, but it's not what you asked for.

Both become one-evening jobs the moment that API ships. They're marked in
`public/admin/config.yml` at the exact fields.

**The emotion icons I'm happier with.** They're in a palette pinned to the
editor's corner showing the actual artwork — click a face, it drops in at
your cursor. Nobody types `:collie-smiling:`, which was the actual
requirement.

**What did work as specified:** the map picker with address search (nobody
types a coordinate), the guided intake in schema order, the live character
counter on the blurb, required alt text that blocks saving, whole-number
star enforcement, the block editor with drag-to-reorder, palette-only
styling, and a live preview using the real stylesheet.

That last one is worth a note: the preview CSS is **generated from
`src/styles/global.css` on every build**. Astro content-hashes the bundled
stylesheet, so there's no stable URL for a plain static page to link to. The
alternative was hand-maintaining a second stylesheet for the preview, which
is two sources of truth for one palette and guaranteed to drift the first
time you change a colour.

**The thing most likely to bite you later:** `public/admin/config.yml` and
`src/content/config.ts` are one contract in two files. If they disagree, a
writer saves something that fails the build, sees an error about zod, and
cannot fix it themselves. `test/cms-config.test.mjs` asserts they agree on
every block type, style option and verdict badge — I verified it fails when
I changed a value in only one file. If you add a field, add it to both; the
test will tell you if you forget.

---

## 6. What I chose not to build, and why

**Google Drive as an image host — deliberately not, as you anticipated.**
Drive is not a CDN: unstable URLs, rate limits, no responsive sizes, no
useful cache headers. A popular post would start returning errors. Any Drive
integration has to *copy* files into the repo, which is what the existing
upload button already does.

**Google Drive import entirely — not built.** The genuinely useful half is
importing a Google Doc draft as blocks, which is unaffected by the CDN
argument and would save real copy-paste. But it needs a Google Cloud
project, an OAuth consent screen (external users need review), a Drive
picker, a Docs API call, a structure-to-blocks mapping, and a second
serverless function. That's a session on its own, and you said a half-wired
OAuth flow is worse than none — it fails at the exact moment a writer is
trying to work. I took the escape hatch in your brief: media library and
direct upload work today, Drive is documented as a next step in
[docs/SETUP-CHECKLIST.md §4](docs/SETUP-CHECKLIST.md#part-4--google-drive-import-not-built).

Before commissioning it, the honest question is whether your writers
actually draft in Docs. If they draft in the editor, it's work for nobody.

**A dark mode toggle — only the automatic version.** A toggle needs
somewhere to remember the choice: either a cookie, which contradicts the
footer's "no cookies" promise, or a flash of the wrong theme on every page
load while JavaScript decides. Following the OS setting is free and silent.
Say the word if you want the toggle and I'll do it properly with the footer
line updated.

**A free colour picker and font dropdown — deliberately not**, per your
brief's own reasoning, and I agree with it. One line in the editor explains
it to writers as a design decision rather than a missing feature.

---

## 7. Things I'd want a second opinion on

**1. `/about` is empty and that's a deliberate hole.** Five sections with
notes on what belongs in each, no prose. It's the one page that has to be in
your voice — it's where a reader decides whether to trust your ratings, and
generated filler would undercut the only thing it exists to do. The
placeholders are styled conspicuously so it can't ship looking finished by
accident. **But it's in the nav and the sitemap right now.** If you'd rather
it not be public until written, say so and I'll pull it from both.

**2. The `repo` OAuth scope is wider than ideal.** The CMS needs to commit
and open pull requests. If this repository is public and staying that way,
`public_repo` is narrower and sufficient — one word in
`netlify/functions/auth.mjs`. I left `repo` because I don't know your plans
and the narrower scope silently breaks the moment the repo goes private.

**3. Cuisine is free text.** `Sichuan` and `Szechuan` would become two pages
with one review each. I made the slug forgiving about case and accents, so
`Cafe` and `Café` are one page, but I can't merge genuine synonyms. A fixed
dropdown would prevent it and would also stop a writer adding a cuisine you
haven't thought of. I'd leave it as-is until you see it actually happen —
but you'll know your writers better than I do.

**4. `blurb` defaults to an empty string rather than being optional.** This
keeps every read site simple (`review.data.blurb` is always a string, never
`undefined`). The tradeoff is that "has no blurb" and "has an empty blurb"
are the same state. I think that's right here, but it's a judgement call and
it's baked into the schema, so it's cheaper to revisit now than later.

**5. Nothing has been tested against the real GitHub OAuth flow.** I can't —
it needs the app and secrets that only you can create. The code follows
Sveltia/Decap's documented handshake and includes a CSRF `state` check, but
step 1.4 of the checklist is a genuine first test, not a formality. If it
fails, the troubleshooting section at the bottom of the checklist covers the
three likely causes.

---

## 8. How to check I didn't break anything

```bash
npm test
```

Build + `sitetest.py` + 36 unit tests. Currently: 0 failures, 0 errors, and
one pre-existing warning that the homepage has a single heading — which is
correct, because there are no reviews to list yet. It resolves itself the
moment you publish one.
