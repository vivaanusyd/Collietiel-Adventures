# Writing a review

Everything here happens in your browser. You never need to install
anything, and you can't break the site — see [What happens when you
submit](#what-happens-when-you-submit).

**The editor:** <https://collietiel-adventures.netlify.app/admin/>

> Editing the files directly instead? See
> [docs/DEVELOPING.md](docs/DEVELOPING.md) — the schema, the frontmatter
> reference, and how the pieces fit together.

---

## Signing in

Click **Sign in with GitHub**. If you don't have an account or haven't been
added yet, ask Vivaan — it takes him a minute.

There's no separate password for this site, on purpose. Your GitHub account
*is* the login, which means there's no site password to leak, and Vivaan can
grant or remove access in one place.

---

## Starting a review

Click **New Review** and work down the form. It asks for things in the order
you'd naturally know them.

### Restaurant name

As it appears on the door. This also becomes the review's web address, so
`Bang Bang Noodles` becomes `/reviews/bang-bang-noodles`.

**That address can't be changed after publishing** without breaking every
link anyone has shared. Get the name right before it goes live; typos in the
name are worth fixing now, not later.

### Where is it?

Search for the address, or drag the pin on the map. That's it — you never
type coordinates, and this is what puts the restaurant on the
[map page](https://collietiel-adventures.netlify.app/map).

Drop the pin on the *front door* rather than the middle of the building, so
someone following it on their phone arrives at the right place.

### Cuisine

One or two words: `Sichuan`, `Café`, `Seafood`. This groups the review onto
a cuisine page with others like it, so **reuse an existing spelling** if one
fits — `Cafe` and `Café` are treated as the same thing, but `Coffee shop` is
a different page with one lonely review on it.

### Date of visit

When you actually went. Reviews are ordered by this, newest first.

### Rating

Whole stars, 1 to 5. There are no half stars — the site can't draw them, and
the form won't let you enter one.

### Verdict badge

One animal per review, the at-a-glance summary that sits on the card.

| | Means |
|---|---|
| 🐷 Pig | Go hungry |
| 🐻 Bear | Huge portions |
| 🐝 Bee | Sweet tooth territory |
| 🦀 Crab | Seafood done right |
| 🦉 Owl | Open late |
| 🐱 Cat | Cosy, lingerable |
| 🦊 Fox | Clever cooking |
| 🐌 Snail | Take your time |

This is a different thing from the emotion icons you write into the review —
this one is the summary, those are punctuation. More on them
[below](#emotion-icons).

### Blurb

One sentence, 20–160 characters, with a counter showing where you are.

The limit is tight because this sentence does **four jobs at once**: it's
the text on the homepage card, the popup when someone taps the map pin, what
appears in a feed reader, and the preview when the link is pasted into a
chat. Write it so it makes sense with no other context — it's often the only
thing someone reads.

You can leave it empty while drafting. It's required to publish.

### Cover photo

Optional. A review with no photo still looks right — it just leads with the
name instead. Add one when you have one.

If you add a photo, write the **description** field too. That's what a
screen reader says instead of the picture, and it's what shows if the image
fails to load. "A bowl of dan dan noodles under a slick of chilli oil", not
"photo".

---

## Writing the review itself

The review is built from **blocks**. Add a block, drag it where you want it,
and each block has its own settings. You can reorder anything at any time.

### The blocks, and when to use each

**Text** — the default, and most of a review. Bold, italic, links, headings,
lists and quotes are in the toolbar.

**Image** — one photo. The **Width** setting is where the layout happens:

| Width | Use it for |
|---|---|
| Full bleed | The one photo worth going edge-to-edge |
| Wide | A photo that deserves more room than the text |
| Normal | Most photos |
| Inset | Something small — a detail, a menu corner |
| Float left / right | A photo with text wrapping around it |

**Gallery** — two or three photos in a row. Good for a sequence of dishes.
Four or more stops reading as a row, so it's capped at three.

**Annotated photo** — a photo with labelled dots on it, for naming specific
things on a table. Two or three labels; the point is to name what you're
about to write about, not to inventory the table.

**Pull quote** — one line, enlarged. A thing the menu said, or your own
sentence worth stopping on.

**Dish list** — dish, price, one-line note. For when you want to list what
you ate without writing a paragraph about each. Prices are free text, so
"market price" and "$18" are both fine.

### Photo descriptions are required

Every photo needs a description before the block will save. It's the single
most useful accessibility thing on the site, and unlike most such things it
can only be written by the person who took the photo.

### Size, alignment and colour

Text blocks have three settings: **Size** (Small / Normal / Large /
Display), **Alignment** (Left / Centred) and **Colour** (Default / Accent /
Muted).

You'll notice there's no colour picker and no font menu. That's deliberate.
Those three colours are the site's palette — using them means that if the
site is ever restyled, your review restyles with it. If everyone picked
their own colours instead, every review would slowly drift apart from every
other one, and fixing it later would mean editing every review by hand
rather than changing one setting.

Same reason the sizes are named rather than numbers: **Large** stays large
if the site's typography changes. `18px` just stays 18px.

---

## Emotion icons

Inside your writing, the cockatiels and collies are the main expressive
tool. Use them as punctuation, mid-sentence:

> Six oysters for forty-two dollars *[shocked cockatiel]* and they arrived
> on a tray roughly the size of a coaster. Once I got past the bill, though,
> the Sydney rocks themselves were excellent *[smiling collie]* — briny,
> properly cold, shucked without a single shell fragment.

To add one, click **Emotion icons** in the bottom-right of the editor and
pick the face you want. It drops in wherever your cursor is.

Two characters covering the two ends of the register. The cockatiel's crest
carries its mood (up = alarmed, flat = bored); the collie's ears and mouth
carry its own.

| Reach for it when |
|---|
| **Shocked cockatiel** — sticker shock, tiny portions, an absurd bill |
| **Unimpressed cockatiel** — bland, forgettable, phoned in |
| **Suspicious cockatiel** — something's off, proceed carefully |
| **Smiling collie** — this is good, straightforwardly |
| **Delighted collie** — outstanding, the reason to come here |
| **Hopeful collie** — would come back, want more of this |
| **Sleepy collie** — cosy, unhurried, comfortable |

Two things worth knowing about how they read:

**Let the sentence carry the meaning.** At the size they render, the
character is legible but fine emotional detail isn't. The icon should
reinforce what you've written, not replace it — a sentence that only works
with the icon doesn't work.

**They lose force if every sentence has one.** Two or three in a review
lands harder than a dozen.

---

## Arranging the page (the canvas)

The blocks above stack top to bottom, which is right for most reviews. When
you want something else — a photo *beside* a paragraph, two things
overlapping, a quote pushed off to one side — open the **canvas**.

There's a button for it in the bottom-right of the editor, or go straight to
[/admin/arrange/](https://collietiel-adventures.netlify.app/admin/arrange/).

**How it works:**

- Hover the **Add** tab on the left edge and a dock slides out. Click a
  block type to drop one onto the page. (Click **Pin** to keep the dock
  open while you work.)
- **Drag** a block to move it. Grab its right or bottom edge to resize.
- Click a block to open its settings on the right.
- **Arrow keys** nudge the selected block one column; hold **Shift** for
  four at a time. Often faster than dragging for small adjustments.
- **Delete** removes the selected block, **Undo** steps back.

**Blocks snap to a grid.** That's deliberate, and it's what stops the page
falling apart: the canvas is 24 columns wide, and a block remembers *which
columns* it sits in rather than how many pixels from the left. Pixels mean
different things on different screens; columns don't.

**Desktop and Phone are two separate arrangements.** Toggle between them at
the top. The phone layout is filled in for you — everything full width,
stacked in the order it reads on desktop — so you only touch it if you want
something different there. Worth a look before you finish, since most
readers are on a phone.

**Saving:** the canvas copies your arrangement to the clipboard, and you
paste it back into the review in the main editor. Not elegant — the two
tools aren't joined up yet. Vivaan knows.

---

## Seeing what it'll look like

The preview pane shows the real page, with the real fonts and colours, as
you type. Switch between desktop and phone width with the toggle — most
readers are on a phone, so it's worth a look before you submit.

---

## What happens when you submit

Nothing you do goes straight to the live site. When you save, your review
becomes a **pull request** — a proposal for Vivaan to review.

The editor shows your review moving through three columns:

| Column | Means |
|---|---|
| **Drafts** | You're still working. Nobody else is looking. |
| **In review** | You've submitted it. Waiting on Vivaan. |
| **Ready** | Approved. Goes live when Vivaan publishes it. |

You can keep editing at any stage; it just moves back to Drafts.

**"Your review is awaiting review"** means it's in the middle column: you've
done your part, and it's with Vivaan. He may publish it, or come back with
comments.

### If something's wrong with it

An automatic check runs on every submission. If it finds a problem you'll
see a red ✗, and clicking through shows what's wrong — nearly always
something required that's missing, like a blurb under 20 characters or a
photo with no description. Fix it in the editor and it re-checks itself.

This is a safety net, not a judgement. It exists so a mistake is caught
before readers see it rather than after.

---

## Editing something already published

Open it in the editor and change it. Same flow — it becomes a pull request.

**If you've changed your actual verdict** — you went back, it was worse, the
chef left — set **Date revised**. Readers see "Updated" with that date under
your name, which is the honest thing to do when a review's conclusion
changes. Leave it empty for typo fixes.

**Don't change the restaurant name after publishing.** The name is the web
address, so changing it breaks every link anyone has shared to that review.
If it genuinely has to change, tell Vivaan so he can set up a redirect.

---

## A few habits worth having

- **Write the blurb last.** It's easier to summarise a review you've
  written than to predict one you haven't.
- **Check it at phone width** before submitting.
- **Say what you'd tell a friend.** The animals and the layout are there to
  support that, not to replace it.
- **A 3 is allowed to be a 3.** If everything is a 4, the ratings stop
  meaning anything.

---

Something confusing, broken, or missing? Tell Vivaan — if the editor made
you guess, that's worth fixing in the editor rather than in a habit.
