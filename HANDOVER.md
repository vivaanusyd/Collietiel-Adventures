# Handover — moving off Netlify to a VPS

Written at the end of the session that decided this, for whoever picks it up
next. It assumes no memory of that conversation.

**Read this before touching anything.** `CLAUDE.md` describes the site as it
is *today* — Netlify, Sveltia CMS, GitHub OAuth. All three are being removed.
Following `CLAUDE.md` without reading this will have you carefully maintaining
things that are on their way out.

---

## 1. Where the project actually is

A working Astro static blog with two editors bolted on, **zero published
reviews**, and no readers. `src/content/reviews/` contains only `_README.md`.

That last part matters more than anything else here: **nothing is live that
anyone depends on.** No bookmarked links, no writer workflow to disrupt, no
SEO to preserve. This is the cheapest moment this migration will ever have,
which is why it's happening now.

### What works today

| Thing | State |
|---|---|
| The public site (home, reviews, map, search, RSS, cuisine pages, sitemap) | Works, well-tested |
| Review schema + block system | Works |
| Canvas editor (`/admin/arrange`) | Works |
| Sveltia CMS (`/admin/`) | Works — **being deleted** |
| Sunday Table editor (`/desk/`) | Works as an editor. **Its Publish only writes to browser `localStorage`** |
| Rendering a Sunday Table review on the site | Built this session. Never seen with real content |
| `/desk/` sign-in gate | Works on Netlify — **being deleted** |
| Netlify deploys | **PAUSED — free-tier credits exhausted.** The last three commits are in `main` and were never deployed |

### The last thing built (and the most valuable thing to keep)

Commit `e5a33c8` — the site can render a Sunday Table review **verbatim**.
This is the foundation the whole new plan sits on, and it is host-independent.
Files:

- `src/lib/desk.ts` — zod schema for a desk document, stored in a review's
  `desk:` frontmatter field. Everything `.passthrough()`s, deliberately.
- `src/lib/desk-render.mjs` — the editor's layout maths, transcribed. Fonts,
  default text styles, per-kind margins, the float offset correction, the
  HTML sanitiser, plain-text extraction. **This is the file to re-check
  whenever the desk is re-exported from Claude Design.**
- `src/components/DeskReview.astro` + `DeskFloat.astro` — the renderer.
- `test/desk-render.test.mjs` (18 tests) + `test/desk-review.test.mjs` (10
  tests, renders the real component via Astro's container API).

**The one clever bit, so nobody "fixes" it:** floating photos are positioned
with pure CSS and no JavaScript. The editor stores a float's `dx`/`dy` as an
offset *from the flow block it's anchored to*, so rendering the float as an
absolutely-positioned **child** of that block reproduces the editor's own
arithmetic for free. Two details look like noise and are load-bearing:

1. Text wrappers carry a `1.5px solid transparent` border, because the editor
   measures border boxes and CSS positions against padding boxes
   (`floatOffsetCorrection`). Remove it and every float shifts 1.5px.
2. The paper paints its background on a `z-index: -2` layer so floats sent
   *behind* the text can sit at `-1`. Move the background onto the paper
   itself and "behind" floats disappear.

---

## 2. What was decided, and why

All of this was settled with Vivaan in one session. The *reasoning* is
recorded because a decision without its reason gets undone by the next person
who sees only the cost.

### Decision 1 — Leave Netlify for a VPS

**Trigger:** Netlify's free tier ran out of credits; production deploys are
paused. The cause is deploy frequency — Vivaan deploys many times an hour to
check whether things work.

**Why not just pay Netlify:** $19/month buys removal of a limit, not a
feature. **Why not Cloudflare Pages:** genuinely considered, and it has a
specific blocker — `netlify/functions/desk.mjs` reads a 1.9 MB file from disk
at runtime, and Workers have no filesystem, plus a Worker bundle size cap that
file would flirt with. **Why not Vercel:** its free tier forbids commercial
use, and Vivaan wants commercial use. **Why not GitHub Pages or Google Drive:**
neither can run code, and the site needs auth.

**Why a VPS wins here:** ~€4–6/month for a machine with a real filesystem,
root access, and **no build credits at all**. Deploys become `git pull` +
rebuild — seconds, unlimited. The problem that started this stops existing
rather than getting a bigger allowance.

**Accepted cost:** Vivaan becomes the sysadmin. He explicitly accepts this and
is fine being the sole developer.

### Decision 2 — Delete Sveltia CMS; the Sunday Table becomes the only editor

Sveltia exists in this repo purely to publish via GitHub. Once the desk can
publish, it has no job. Vivaan's words: "Sveltia really has no reason to
exist."

### Decision 3 — Google sign-in with an email allowlist, not GitHub

**The constraint that used to make GitHub mandatory:** publishing means
committing to a Git repo, so "who is a writer" and "who can commit" were the
same question — which forced writers to have GitHub identities.

**A VPS removes that constraint.** The *server* commits, setting the commit
author to the writer's name and email from their Google identity. So you keep
real version history and honest per-writer attribution, and no writer ever
touches GitHub.

Both writers do have GitHub accounts; Vivaan still prefers Google because
GitHub adds nothing once the server is doing the committing. GitHub remains as
a **backup remote only**.

### Decision 4 — Both writers can publish live; no review gate

Two writers who know each other. Vivaan: "a human error with two people isn't
that risky for me." The safety net is Decision 5 plus `git revert`, and the
commit records who did it.

### Decision 5 — A bad publish must never take the site down

Vivaan's design, refined into two layers:

1. **Validate before writing anything.** Schema-check the incoming document —
   required fields, coordinates, image references. On failure: nothing is
   committed, nothing to reverse, and the writer sees a red message with the
   real reason. Catches almost everything.
2. **Build into a temp directory; swap only on success.** If it validates but
   the build still breaks, revert the commit, return the review to editable,
   and leave the live site on the previous build. Readers see nothing.

### Decision 6 — Publish UX (asked for, not yet built)

After clicking Publish, the desk returns to the reviews list with a message
that fades on its own:

- Success: **"blog published"**.
- Failure: red, **"blog publish failed"**, plus the error code and a short
  plain reason.

**Settled:** it returns to the **dashboard** — the desk's own list of drafts
and published reviews — and the message appears there, not on the reader list
and not on the live site. (This was the one open question; Vivaan confirmed
the dashboard.)

### Decision 7 — Phone layouts are Stage C, deferred indefinitely

The renderer currently drops floats into the text flow below 780px, because a
pixel offset inside a 720px page can't survive a phone. Vivaan wants a proper
per-review phone arrangement *eventually*, after publishing works. Not soon.

---

## 3. Target architecture

One VPS. Caddy in front (it handles HTTPS renewal automatically), a small Node
service behind it, and the built static site on disk.

```
Reader      →  Caddy  →  static files in /srv/site/current
Writer      →  Caddy  →  Google sign-in (allowlisted emails)
                      →  the Sunday Table
Publish     →  Caddy  →  Node service (localhost only)
                           ├─ validate document
                           ├─ write content + images
                           ├─ git commit (author = the writer)
                           ├─ build into a temp dir
                           ├─ swap dir on success / revert on failure
                           └─ push to GitHub as backup
```

### Security requirements (not optional, and not exotic)

- **One write endpoint.** Publish. Everything else is static.
- **Re-encode every uploaded image** through `sharp` rather than trusting it —
  strips anything hidden in the file and enforces size in one step.
- **Never use a client-supplied filename.** Generate them server-side. This
  single rule kills path traversal.
- **Node binds to localhost**, reachable only through Caddy.
- **Run as an unprivileged user**, never root.
- **SSH keys only, no password login, no root login, unattended security
  updates.** Day one, three settings.
- **Auth checked on every write**, not once at page load.

---

## 4. What to keep, what to delete

### Delete — all of it is host-shaped, none should be ported

- `netlify/` (all four functions and `netlify/lib/session.mjs`)
- `netlify.toml`
- `public/admin/` (Sveltia config, `index.html`, `preview.css`)
- `test/session.test.mjs`, `test/cms-config.test.mjs`
- `scripts/sync-preview-css.mjs` (exists only to feed Sveltia's preview pane)
- The `devDesk` hook in `astro.config.mjs` — the new server serves `/desk/`
  for real
- `DESK_SESSION_SECRET`, the GitHub OAuth app, the Netlify site

**Do not port the session/HMAC gate.** Google sign-in replaces it entirely.

### Keep — none of it touches the host

- The whole reading side: `src/pages/`, `src/layouts/`, `src/components/`
- The schema (`src/content/config.ts`) and `src/lib/` — reviews, blocks,
  layout, images, markdown, emotions, **and everything `desk*`**
- `scripts/optimize-images.mjs`
- `sitetest.py` and the remaining tests
- `functions-assets/desk.html` — the editor itself (see the warning below)

### Decide, don't assume

- **The canvas editor** (`/admin/arrange`) — it's good work and it's a
  *second* editor. If the Sunday Table is the only way in, the canvas is
  probably dead too. Its grid maths (`src/lib/layout.mjs`) is shared with the
  published page, so removing it is not a clean delete. **Ask.**
- **`reaction:`** — retired this session, still optional in the schema so old
  files validate. With zero reviews in the repo, it can now simply be deleted,
  along with `src/lib/reactions.ts` and the icons.
- **`blocks:`** — if the desk is the only editor, does the block system still
  earn its place? It is a lot of surface area for a path nobody walks.

---

## 5. Traps

**`functions-assets/desk.html` is generated output with three hand-patches.**
Re-exporting the prototype from Claude Design wipes all three. They are:

1. The Publish button handler (`out.publish=`) — without it, Publish in the
   editor toolbar does nothing at all.
2. `out.viewSite=` → opens the real site at `/` in a new tab.
3. (Whatever Stage B adds.)

Grep for `window.open('/'` and `out.publish=`. This is documented in
`NOTES-FOR-VIVAAN.md`; fix them in the Claude Design source too, or they will
be rediscovered in three months by someone with no idea why.

**Never write review content.** Hard rule from `CLAUDE.md`, and it held all
session: do not invent restaurants, meals, prices, opinions or verdicts. It's
why the desk renderer has tests instead of a demo page — the test fixture is
deliberately `'A title'` / `'A paragraph'`, not a fake restaurant.

**Nobody has ever seen a desk review render with real content.** The evidence
is 10 tests asserting the markup. That is real verification, but it is not
eyes on a page. Expect visual surprises with the first real review.

**Three known fidelity gaps** between the desk and the published page, all
deliberate, all in `docs/DEVELOPING.md`:

1. **Fonts** — the desk offers 8 families; the site self-hosts only Fraunces
   and Inter and promises no third-party requests, so most fall back to
   Georgia. Fixing this is pure work with no trade-off: self-host the eight.
   Vivaan has been offered this and hasn't scheduled it.
2. **Half stars** — the desk stores `4.5`, the schema stores whole stars, so a
   card can show 4 where the page shows 4.5.
3. **Phones** — see Decision 7.

**`npm test` needs `--config vitest.config.mjs`.** Rendering a real `.astro`
component in a test requires Astro's compiler, and Vitest would not pick the
config up by name. It's already wired into the `package.json` scripts.

**Commercial use has consequences nobody has acted on yet.** The site's footer
promises no cookies and no trackers; `ANALYTICS.md` exists because that was
deliberate. Ad networks and affiliate programs break that promise, and
sponsored reviews legally require disclosure in AU and the US. Vivaan wants
everything done legally and is happy to disclose — **but no disclosure field
exists in the schema yet.** Cheap now, awkward to retrofit.

---

## 6. The plan

Ordered so the site is never in a half-migrated state, and each phase ends
somewhere you could stop.

**Phase 0 — Vivaan's accounts.** Domain, VPS, Google OAuth client. See §7.

**Phase 1 — A machine that serves the site.** Provision, harden (the security
list in §3), install Node and Caddy, clone the repo, build, serve static files
over HTTPS on the new domain. No auth, no editor, no publishing. Ends with the
current public site live on the new domain, off Netlify.

**Phase 2 — Google sign-in.** OAuth against the allowlist, a session cookie,
and `/desk/` served only to signed-in writers. Ends with the editor reachable
by two people and nobody else.

**Phase 3 — Publishing (the real work).**
- The publish dialog in the desk: map picker for coordinates (Leaflet +
  OpenStreetMap — free, no API key, and the site already uses those tiles),
  cuisine, blurb. Date stamped on click.
- Images: base64 in the document → real files via `sharp`.
- The publish endpoint: validate → write → commit as the writer → build to
  temp → swap or roll back → push to GitHub.
- The Decision 6 messages, including the failure path, which finally has a
  real code and reason to report.

**Phase 4 — Delete Netlify.** Remove `netlify/`, `netlify.toml`,
`public/admin/`, the dead tests and scripts. Update `CLAUDE.md`,
`docs/DEVELOPING.md`, `docs/SETUP-CHECKLIST.md`, `EDITING.md` — all four
currently describe a Netlify/Sveltia site. Delete the Netlify site and the
GitHub OAuth app. **Deliberately last:** nothing is deleted until its
replacement demonstrably works.

**Phase 5 — Whatever's next.** Self-hosted fonts. The disclosure field. The
canvas/blocks decision. Stage C phone layouts.

---

## 7. What Vivaan does before Phase 1

1. **Buy a domain.** Any registrar; Cloudflare sells at cost (~$12/yr). Turn
   on auto-renew — a lapsed domain is how blogs die.
2. **Rent a VPS.** Hetzner is the value pick (~€4/mo); the smallest tier is
   ample. Pick a region near the readers. Add an SSH key during creation —
   **not a password.**
3. **Point the domain at it.** One A record → the server's IP. Caddy handles
   HTTPS from there.
4. **Create a Google Cloud project** with an OAuth 2.0 Client ID (type: web
   application). Have the client ID and secret ready — **and do not paste them
   into the repo or into chat.**
5. **Decide the two allowlisted Gmail addresses.**
Nothing above needs a developer. Everything after it does.
