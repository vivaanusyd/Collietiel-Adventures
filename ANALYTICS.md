# Checking your readers once the site is published

## First: what you cannot know

This site has no accounts, no database, and no comments. So there is no
mechanism — and no add-on you can bolt on — that tells you **which
individual people** read your reviews. You cannot get names, emails, or
"Sarah from Newtown read the oyster review."

That isn't a limitation of Astro or of static hosting. It's how the web
works without a login. Any product promising individual reader identity is
either doing device fingerprinting (legally fraught, and increasingly
blocked by browsers) or overselling what it has.

What you get instead is **aggregate**: counts, not people.

## What you can actually see

| Signal | How reliable |
|---|---|
| Page views per URL | Good |
| Referrer (where the click came from) | Good, though a lot shows as "direct" |
| Country, sometimes city | Rough — IP geolocation, often wrong by a city |
| Device / browser / screen size | Good |
| Time on page, bounce rate | Approximate at best; treat as a trend, not a number |
| Search terms people used to find you | Only via Search Console (below), not analytics |

Three honest caveats:

1. **Ad blockers eat script-based analytics.** Expect to undercount by
   roughly 10–40% depending on audience. A food blog skews less technical
   than, say, a dev blog, so you'll lose less — but you will lose some.
2. **The RSS feed bypasses analytics entirely.** Feed readers fetch
   `/rss.xml` and render your blurb without ever loading a page. Those
   readers are invisible to any client-side tool.
3. **Small numbers are noise.** At a few hundred views a month, don't read
   meaning into week-to-week wiggles.

## Options

Prices move — check current pricing before committing.

| Tool | Cost | Cookies | Notes |
|---|---|---|---|
| **Cloudflare Web Analytics** | Free | None | Free and cookieless. Works via a JS beacon on any host. Good default. |
| **GoatCounter** | Free for personal | None | Open source, tiny script, deliberately simple. |
| **Vercel Web Analytics** | Free tier, capped events | None | Zero-config if you deploy on Vercel. |
| **Netlify Analytics** | Paid, ~US$9/mo per site | None | Server-side — reads their edge logs, so **ad blockers can't block it** and there's no script to slow the page. The only paid option here that buys you something real. |
| **Plausible / Fathom** | Paid, ~US$9/mo | None | Nicer dashboards, privacy-first, hosted in the EU. |
| **Umami** | Free self-hosted | None | You run it. Only worth it if you already have somewhere to run it. |
| **Google Analytics 4** | Free | **Yes** | Most powerful and most invasive. Needs a consent banner for EU/UK visitors, and the setup burden is real. I'd skip it for a blog this size. |

**Google Search Console** is separate from all of the above and worth
having regardless: free, no script on your site, and it's the *only* thing
that tells you which Google searches surfaced your pages. Verify your
domain, then submit `https://yourdomain.com/sitemap.xml` — that endpoint
already exists in this project.

## My recommendation

Start with **Cloudflare Web Analytics (or GoatCounter) + Google Search
Console**. Both free, neither sets cookies, and together they answer the
two questions you'll actually have: *which reviews get read* and *what
people searched to find them*.

Move to Netlify Analytics later only if ad-block undercounting starts
bothering you.

## Where it plugs in

One place: the `ANALYTICS SLOT` comment in the `<head>` of
[`src/layouts/BaseLayout.astro`](src/layouts/BaseLayout.astro). Paste the
provider's snippet there and it applies to every page, since every page
goes through that layout.

I deliberately left it empty. Adding tracking is a decision with legal and
ethical weight, and it isn't mine to make silently on your behalf. As
shipped, this site sets **no cookies and collects nothing**, which is why
the footer can honestly say so — if you add analytics, revisit that footer
line in `BaseLayout.astro`.

## The legal part

**I'm not a lawyer and this isn't legal advice** — it's orientation so you
know what to look into.

- **Australia (you):** the Privacy Act 1988 and the Australian Privacy
  Principles. There's a small-business exemption (under ~$3M annual
  turnover) that a personal blog would typically fall under, but it's not
  automatic and it doesn't cover everything.
- **EU/UK readers:** GDPR applies based on *your readers'* location, not
  yours. A single German reader in principle brings it into scope. Cookie-
  based analytics (i.e. Google Analytics) requires consent **before** the
  script loads — that's what cookie banners are for.
- **Cookieless, aggregate analytics** is widely treated as not requiring a
  consent banner, and that's why every tool above advertises it. But it's
  an area regulators keep revisiting, and "widely treated as" is not the
  same as settled. If the site ever becomes commercial, get proper advice.

The practical upshot: **picking a cookieless tool sidesteps almost all of
this**, which is the main reason to prefer one.
