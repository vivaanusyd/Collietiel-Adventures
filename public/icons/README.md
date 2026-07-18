# Icons

Every icon in the project lives in this one folder. Three groups, by job:

## 1. Inline emotion icons — cockatiels & collies

The ones you drop **into review prose**. Type the shortcode; a remark
plugin turns it into an inline image at build time.

```markdown
Six oysters for forty-two dollars :cockatiel-shocked: and they arrived
on a tray the size of a coaster. The oysters themselves were excellent
:collie-smiling: — briny and properly cold.
```

Two characters, two emotional registers. The **cockatiel's crest** carries
its mood (up = alarmed, flat = bored); the **collie's ears and mouth**
carry its own.

| Shortcode | For |
|---|---|
| `:cockatiel-shocked:` | Sticker shock, tiny portions, an absurd bill |
| `:cockatiel-unimpressed:` | Bland, forgettable, phoned in |
| `:cockatiel-suspicious:` | Something's off, proceed carefully |
| `:collie-smiling:` | This is good, straightforwardly |
| `:collie-delighted:` | Outstanding, the reason to come here |
| `:collie-hopeful:` | Would come back, want more of this |
| `:collie-sleepy:` | Cosy, unhurried, comfortable |

A typo like `:colie-smiling:` stays as literal text and prints a warning in
the terminal with the valid list — it won't fail the build, because dying
on a stray colon in prose would be worse. Shortcodes inside `` `backticks` ``
are left alone.

**To add one:** add an entry to `src/lib/emotions.mjs` *and* drop a PNG here
with the same name. The build fails if you do only the first.

Size and baseline nudge are tunable in one place — `--emotion-icon-size`
and `--emotion-icon-nudge` in `src/styles/global.css`.

## 2. Verdict badges — the per-review animal

Exactly **one per review**, set in frontmatter as `reaction:`, shown on the
homepage card and review page. A different job from the inline icons: this
is the at-a-glance summary, not punctuation inside a sentence.

`pig` `bear` `bee` `crab` `owl` `cat` `fox` `snail`

Valid values come from `src/lib/reactions.ts`. A typo fails the build.

## 3. Free-standing icons

`yum` `meh` `nope` `fire` — not tied to anything, use anywhere.

## Using any icon in a component

```astro
import Icon from '../components/Icon.astro';
<Icon name="fox" size={40} alt="clever cooking" />
```

Throws at build time with the available list if the name is wrong. Don't
use this for emotion icons inside review prose — use the shortcode.

## Notes

All the art is crude geometric placeholder work. Overwrite any filename
with real hand-drawn art and nothing else needs to change. Transparent
background, square, ~128×128 is plenty.

Icons live in `public/` rather than `src/` because the Markdown shortcode is
rewritten before Vite's asset pipeline exists, so it can only emit a plain
URL. One folder for everything beat two folders with different rules. The
tradeoff: no content-hashing, so a browser may serve a stale icon after you
overwrite one — rename it or set cache headers if that ever bites.
