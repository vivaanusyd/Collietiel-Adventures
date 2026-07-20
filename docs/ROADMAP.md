# What a full site needs

A map of everything between what exists now and "a proper full-fledged
website": accounts, an admin area, comments, feedback. Written to be
decided from, not to be implemented top-to-bottom — several items here are
worth *not* doing, and those are marked.

The short version is at the bottom under **Recommendation**.

---

## 1. First: how admin access actually works

Worth settling before designing anything, because the intuition is usually
wrong and it changes what's worth building.

### Hiding the URL is not security

`/admin/` can be found. It's in a public repository, it's in the sitemap's
exclusion list, and anyone can guess it. That is **fine**, and it's not the
thing keeping people out.

What keeps people out is that the page can't *do* anything without a token,
and the token is only issued after GitHub checks the account against this
repository's collaborator list — on GitHub's servers, where nothing in the
browser can influence the answer. A stranger who opens `/admin/` sees a
sign-in button and hits a wall behind it.

This is the standard model: **authentication and authorisation happen
server-side; the client is assumed hostile.** Obscuring the URL is
decoration on top of it, the same way a password checked in page JavaScript
would be.

### What IS worth adding, and why

| Measure | What it buys | Cost |
|---|---|---|
| **`noindex` + unlinked** | Keeps it out of search results and out of a casual reader's way | Done already |
| **Separate subdomain** (`admin.collietiel…`) | Clean separation; makes network-level rules easy to apply later | An hour, DNS |
| **Edge auth** (Cloudflare Access free tier, or Netlify password protection) | A locked front door *before* the page loads. Real defence in depth — blocks probing, scanning, and any future bug in the app itself | Free–$/mo, ~an hour |
| **Audit trail** | Every change is already a Git commit with an author and timestamp. Better than most admin panels have | Done already |

Edge auth is the one genuinely worth adding. Not because the current setup
is weak, but because "an attacker can't even reach the code" is a stronger
position than "the code correctly rejects them", and it costs almost
nothing.

### Google sign-in: right for readers, wrong for writers

This one has a real constraint behind it.

The CMS **commits to GitHub as the writer**. That's why it needs a GitHub
identity: the commit author is them, and the permission check is GitHub's.
It's also why removing a writer is one click and takes effect instantly.

To sign writers in with Google instead, you'd need a server holding a GitHub
bot token, your own table of who's allowed to do what, and commits made on
their behalf. Three consequences:

1. Every commit is authored by the bot — you lose the per-writer history.
2. **You become the access-control authority.** Today GitHub is. That's a
   real transfer of responsibility, not just plumbing.
3. It's a server you now run and patch.

So the clean split, and what most sites of this shape do:

- **Writers → GitHub.** They're a handful of known people; a GitHub account
  is a reasonable ask and buys you real per-author history.
- **Readers → Google / email.** A reader should never need a GitHub account
  to leave a comment. This is where Google sign-in belongs.

---

## 2. The fork in the road

Everything else on this page — comments, profiles, saved settings, a
feedback inbox — needs **state that outlives a deploy**. The site currently
has none: it's static files plus two stateless OAuth functions.

That's the fork. Not a technical detail — it changes what this project is.

### Path A — stay static, rent the dynamic parts

Keep `output: 'static'`. Use third-party services for anything needing a
database.

- Comments: a hosted or self-hosted widget (see §4)
- Feedback: a form service (Netlify Forms, Formspree)
- Settings: stay as files in the repo, edited through the CMS
- **Cost:** roughly free, near-zero maintenance
- **Limit:** no reader accounts you control, no live admin dashboard

### Path B — become an application

Astro with a server adapter, plus a database and auth provider (Supabase and
Clerk both have first-party Astro support; Better Auth is the framework-
agnostic option).

- Real accounts, roles, comment moderation queue, feedback inbox, settings UI
- **Cost:** more code by an order of magnitude, a database to back up, a
  server to patch, and permanent legal obligations (§6)
- This is what "full-fledged" literally means

**Both are legitimate.** The mistake is drifting into B by accident, one
feature at a time, and discovering you now run a service.

---

## 3. Admin area — the two profiles

You asked for a client profile and a dev profile. That maps to two surfaces
with different audiences, and they're worth keeping genuinely separate
rather than one page with things greyed out.

### Owner / editor surface

Things a non-technical owner should change without asking anyone:

- Site name, tagline, description *(today: `src/lib/site.ts`)*
- Social preview image, favicon
- Feature toggles — comments on/off, feedback form on/off
- Homepage: featured review, reviews per page
- Writer management — invite, change role, remove *(today: GitHub's UI)*
- Comment moderation queue
- Feedback inbox
- "What's live right now" — last deploy, whether it succeeded

### Developer surface

- Deploy status and logs, trigger a rebuild
- Build/test failures with the actual error
- Content health: reviews missing a blurb, broken image paths, orphaned files
- Schema and CMS-config drift check *(today: a unit test)*
- Environment variable status — set/unset, never the values
- Redirects, robots.txt, sitemap status

**Worth noticing:** most of the owner list is *config that could live in a
file the CMS already edits*. A settings page backed by a repo file gets you
most of this on Path A, with version history and no database. Only the
moderation queue and feedback inbox genuinely need Path B.

---

## 4. Comments

The feature with the widest gap between "add comments" and what it actually
costs.

### Options

| Option | Reader signs in with | Data lives | Notes |
|---|---|---|---|
| **Giscus** | GitHub | GitHub Discussions | Free, no database, no tracking. **But it requires a GitHub account to comment** — fine for a dev blog, wrong for a food blog audience |
| **Cusdis / Remark42** | Nothing, or social | Your server | Self-hosted, privacy-friendly, lightweight. You run and patch it |
| **Disqus** | Disqus account | Their servers | Injects ads and cross-site tracking on the free tier. Would make the footer's privacy claim false. **Not recommended** |
| **Build it** | Whatever you choose | Your database | Full control, full responsibility. Path B |

### What comments actually bring with them

The widget is the easy part. These are not optional:

- **Spam.** An unmoderated comment box on any indexed site fills with spam
  within weeks. Needs filtering or pre-moderation.
- **Moderation.** Someone reads every comment. On a review site that
  includes defamatory claims about restaurants — a real liability.
- **Rate limiting**, or one person floods it.
- **A comment policy** readers can be held to.
- **Deletion path** — someone will ask for their comment and account gone,
  and in several jurisdictions they're entitled to it.
- **Notifications**, or nobody knows a comment arrived.

Honest observation: the site currently has **zero published reviews**. A
moderation queue built before the first comment exists is a solution
looking for a problem. Comments are worth adding when there are readers who
want to say something.

---

## 5. Feedback / "tell us how to improve"

Much cheaper than comments, and useful immediately — it's private, so it
needs no moderation queue, no spam-facing public surface, and no accounts.

- A form on its own page, linked in the footer
- Fields: message, optional email for a reply, which page they came from
- **Where it goes:** Netlify Forms (100/month free, has spam filtering
  built in) is the least-effort real option and needs no backend
- Honeypot field + rate limit
- A confirmation that actually confirms

This is the single highest value-per-hour item on this page.

---

## 6. The part that's easy to skip

Once the site stores anything about a person, obligations attach. This isn't
optional and it isn't only a Path B problem — a feedback form storing an
email address counts.

- **Privacy policy** — what's collected, why, how long, who else sees it
- **Comment/community policy** — what gets removed, and why
- **Cookie consent** — the moment an auth cookie is set
- **Data deletion** — a real, working path, not an email address that goes nowhere
- **Moderation liability** — reviews name real businesses; user comments
  about them are your publishing decision
- **Backups** — a database with your readers' comments needs them

**The footer currently says "No trackers, no comments, no accounts."** All
three stop being true. That line, and much of ANALYTICS.md, has to be
rewritten honestly — the current claim is a genuine asset and giving it up
should be a decision, not a side effect.

---

## 7. Still outstanding from before

Independent of all this:

- **`/about` has no prose.** It's live, in the nav, and every section says
  "To be written." Highest-priority content gap.
- **Zero published reviews.**
- Newsletter capture, social sharing buttons — both cheap, both matter more
  once there's traffic
- Canvas ↔ CMS still joined by a clipboard copy (see NOTES-FOR-VIVAAN.md)

### Wiring the Sunday Table (`/desk/`) to real publishing

**Status: the reading half is done.** The site can render a Sunday Table
review — stored verbatim in a `desk:` field, drawn by `DeskReview.astro`. See
"Publishing a Sunday Table review" in DEVELOPING.md. What remains is the
writing half:

1. A publish dialog in the desk collecting what the site needs and the desk
   doesn't have: coordinates (the CMS's map picker — free, no API key), a
   cuisine, and a blurb for cards and RSS. The date is stamped on click.
2. Photos become real files in `public/images/reviews/` instead of the
   base64 the document carries today.
3. Publish opens a pull request through the GitHub API, **behind an in-page
   confirmation step** — not a popup window — so nothing commits on a stray
   click.
4. That step is where the writer's GitHub token has to be *kept* rather than
   spent once and discarded, which is the security decision to make
   deliberately rather than by accident. Narrowing the OAuth scope from
   `repo` to `public_repo` is the cheap mitigation while the repo is public.

The original analysis follows.


The Sunday Table editor ships verbatim at `/desk/` (launched from the
signed-in CMS corner), but its Publish button only flips a flag in that
browser's localStorage — nothing reaches the site. The sanctioned path to
making it real is the model Sveltia already uses, with the pieces this repo
already has:

1. Sign-in reuses `netlify/functions/auth.mjs` / `callback.mjs` — the
   browser ends up holding the *writer's* GitHub token, secrets stay in
   Netlify env.
2. Publish becomes a commit/PR made through the GitHub API **as that
   writer** — per-author history and the collaborator-list permission check
   carry over for free, and drafts/review flow arrive as pull requests,
   same as CMS submissions.
3. Only after that works does retiring Sveltia become an option, not
   before — until then it is the only machinery that publishes.

Two things to hold onto when that project starts: the desk's free-pixel
document model has no mapping to the review block schema yet (that mapping
*is* the project), and edge auth from §1, once added in front of `/admin/`,
should cover `/desk/` in the same rule. Writers stay on GitHub sign-in —
§1's "Google is for readers" analysis applies unchanged.

---

## Recommendation

**Stage 1 — this week, stays on Path A, ~a day of work**

1. Feedback form via Netlify Forms — the best value here by a distance
2. Edge auth in front of `/admin/` (Cloudflare Access free tier)
3. A settings file the CMS edits, replacing hardcoded values in
   `src/lib/site.ts` — the "owner profile", version-controlled, no database
4. A developer status page: build health, content warnings, config drift

That covers most of what you described, keeps the site free and
maintenance-light, and keeps the privacy claim true.

**Stage 2 — only when there's a reason**

Comments and reader accounts, when there are readers asking to comment. At
that point Path B with Supabase (Google sign-in, Postgres, first-party Astro
support), plus the §6 obligations done properly.

**The argument for waiting** isn't that it's hard — it's that every stored
account is a permanent responsibility, and a comment system with no comments
is pure cost. Publish reviews, see whether people want to respond, then
build it for the audience you actually have rather than the one imagined
now.

That said, it's your call, and Stage 2 is entirely doable if you want it.
