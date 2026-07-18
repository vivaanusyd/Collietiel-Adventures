# Setup checklist

Everything that has to be done by hand, in the order it has to happen.
These are the steps that need a browser, a dashboard, or a decision only
you can make — none of them can be done from the repository.

**Until you finish Part 1, the editor at `/admin/` will load and then fail
to sign anyone in.** Everything else on the site already works.

Time: about 15 minutes.

---

## Part 1 — Make the editor work (required)

The editor signs writers in with their GitHub account. That takes a GitHub
OAuth app (which you create) and two secret values (which you paste into
Netlify). The secret can never live in this repository — the repo is
readable, and Git remembers a secret even after a later commit removes it.

### 1.1 Create the GitHub OAuth app

1. Go to <https://github.com/settings/developers>.
2. Click **OAuth Apps**, then **New OAuth App**.
3. Fill in exactly:
   - **Application name:** `Collietiel Adventures CMS`
   - **Homepage URL:** `https://collietiel-adventures.netlify.app`
   - **Authorization callback URL:**
     `https://collietiel-adventures.netlify.app/api/callback`
4. Click **Register application**.
5. Leave this page open — the next step needs two values from it.

> The callback URL must match **character for character**, including
> `https://` and with no trailing slash. A mismatch is the single most
> common reason sign-in fails, and GitHub's error message for it
> ("redirect_uri_mismatch") does not say which character is wrong.

### 1.2 Copy the two credentials

On the page you just landed on:

1. Copy the **Client ID**. It's visible on the page and safe to paste
   anywhere.
2. Click **Generate a new client secret**. Copy it immediately — GitHub
   shows it once and never again. If you lose it, generate another; the old
   one stops working.

**Do not paste either value into a file in this repository.** They go into
Netlify in the next step and nowhere else.

### 1.3 Put them into Netlify

1. Go to <https://app.netlify.com>, open the **Collietiel Adventures** site.
2. **Site configuration → Environment variables → Add a variable**.
3. Add these two, exactly as named — the code looks for these spellings:

   | Key | Value |
   |---|---|
   | `GITHUB_OAUTH_ID` | the Client ID from step 1.2 |
   | `GITHUB_OAUTH_SECRET` | the client secret from step 1.2 |

4. Scope: leave as **All scopes / All deploy contexts**.
5. **Deploys → Trigger deploy → Deploy site.** Environment variables are
   read at build time, so a redeploy is required — the editor will keep
   failing until you do this.

### 1.4 Check it works

1. Go to <https://collietiel-adventures.netlify.app/admin/>.
2. Click **Sign in with GitHub**. A popup asks you to authorise the app.
3. You should land in the editor with a **Reviews** collection.

If sign-in fails, see [Troubleshooting](#troubleshooting) at the bottom.

---

## Part 2 — Add a writer

Do this once per person. There is no separate account to create: access is
GitHub repository access, granted and revoked in one place.

1. Go to
   <https://github.com/vivaanusyd/Collietiel-Adventures/settings/access>.
2. **Add people** → their GitHub username → **Add**.
3. Choose the role:

   | Role | What they can do |
   |---|---|
   | **Write** | Use the editor, submit reviews for your approval. **This is the one for writers.** |
   | **Admin** | The above, plus merge and publish. Only for a co-editor. |

4. They accept the emailed invitation, then go to
   `https://collietiel-adventures.netlify.app/admin/` and sign in.
5. Send them **[EDITING.md](../EDITING.md)** — it's written for someone who
   will never see the code.

**To remove someone:** remove them from that same page. Access ends
immediately; anything they already wrote stays.

> A writer with **Write** access cannot publish to the live site on their
> own. The editor is configured so their work always arrives as a pull
> request for you to approve. That's enforced by GitHub, not by the page.

---

## Part 3 — Get found by Google (optional, 10 minutes)

Worth doing once. Nothing on the site depends on it.

1. Go to <https://search.google.com/search-console>.
2. **Add property → URL prefix →**
   `https://collietiel-adventures.netlify.app`
3. Verify with the **HTML tag** method. It gives you a `<meta>` tag: paste
   it into the `<head>` of `src/layouts/BaseLayout.astro`, next to the other
   meta tags, then push.
4. Once verified: **Sitemaps → add** `sitemap.xml` → **Submit**.

See [ANALYTICS.md](../ANALYTICS.md) for what this tells you and what it
doesn't.

---

## Part 4 — Google Drive import (not built)

The brief asked for importing photos and drafts from Google Drive. It isn't
built, and the reason is worth reading before commissioning it — the work is
larger than it sounds, and part of it may not be worth doing at all.

**Photos from Drive: deliberately not done as a direct link.** Drive is not
a CDN. Its image URLs are unstable, rate-limited, serve no responsive sizes
and set no useful cache headers. Pointing the site's images at Drive is the
fastest way to make a fast site slow, and a popular post would simply start
returning errors. Any Drive integration must *copy* the file into the repo,
where Netlify's CDN serves it — which is what the existing upload button
already does, just from your computer rather than from Drive.

**What that leaves genuinely useful:** importing a Google Doc draft as
blocks, so a writer who drafts in Docs doesn't have to copy-paste. That's a
real saving and is unaffected by the CDN argument.

**Why it's not built:** it needs a Google Cloud project, an OAuth consent
screen (which for external users needs review), a Drive picker, a Docs API
call, a mapping from Doc structure to blocks, and a second serverless
function. That's a session's work on its own, and a half-wired OAuth flow is
worse than none — it fails at the moment a writer is trying to work. The
brief says to say so rather than force it.

**If you want it:** the honest first question is whether your writers
actually draft in Docs. If they draft in the editor, this is work for
nobody. If they do, the Docs-import half is the part to build, and the
scopes to request are `drive.file` (only files the user picks — not their
whole Drive) and `documents.readonly`.

---

## Troubleshooting

**"redirect_uri_mismatch" when signing in.**
The callback URL in the GitHub OAuth app doesn't exactly match. It must be
`https://collietiel-adventures.netlify.app/api/callback` — check for a
trailing slash, `http` instead of `https`, or a typo in the domain.

**"GITHUB_OAUTH_ID is not set".**
The variables aren't in Netlify, or the site hasn't been redeployed since
they were added. Do step 1.3 again, including the redeploy.

**The popup opens and closes, and nothing happens.**
Usually a popup blocker. Allow popups for the site and try again.

**A writer signs in but sees no Reviews collection.**
They probably don't have repository access yet, or haven't accepted the
invitation. Check Part 2.

**A pull request shows a red ✗.**
The build failed — click **Details** on the check to see why. It's almost
always a review missing something required (usually a blurb under 20
characters, or a missing image description). The message names the file and
the field.
