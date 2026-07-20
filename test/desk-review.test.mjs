import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import DeskReview from '../src/components/DeskReview.astro';

// Renders the component the way the site renders it, and asserts the numbers
// that decide WHERE things land.
//
// The unit tests in desk-render.test.mjs pin the maths; this pins the markup
// that maths turns into, which is the half that can be wrong while every
// other test passes — a float positioned relative to the wrong element still
// computes the right offset, it just draws it in the wrong place.
//
// The sample document below is deliberately not a restaurant review. It's the
// smallest arrangement that exercises each feature: a heading, a paragraph, a
// banner, a floating photo, a shape sent behind the words.

const doc = {
  media: [
    { src: '/images/reviews/banner.jpg', label: 'banner' },
    { src: '/images/reviews/side.jpg', label: 'side' },
  ],
  styles: {},
  flow: [
    { id: 1, kind: 'banner', media: 0, h: 300, bleed: true },
    { id: 2, kind: 'text', type: 'heading', text: 'A heading' },
    { id: 3, kind: 'text', type: 'body', text: 'A paragraph with <b>bold</b> in it.' },
  ],
  floats: [
    {
      id: 9,
      kind: 'image',
      anchor: 3,
      dx: -196,
      dy: -6,
      w: 168,
      h: 210,
      rot: -3,
      media: 1,
      radius: 14,
    },
    {
      id: 10,
      kind: 'shape',
      shape: 'circle',
      anchor: 2,
      dx: -116,
      dy: 2,
      w: 74,
      h: 74,
      color: '#b8dbc9',
      behind: true,
    },
    { id: 11, kind: 'shape', shape: 'triangle', anchor: '$meta', dx: 40, dy: 10, w: 120, h: 110 },
  ],
};

const review = {
  meta: {
    title: 'A title',
    subtitle: 'A subtitle',
    cuisine: 'A cuisine',
    location: 'A place',
    rating: 4.5,
    author: 'An author',
    date: 'Jul 2026',
    tags: 'one, two',
  },
  doc,
};

async function render(props = { review }) {
  const container = await AstroContainer.create();
  return container.renderToString(DeskReview, { props });
}

describe('rendering a Sunday Table review', () => {
  it('places a float at its stored offset from its anchor', async () => {
    const html = await render();
    // dx -196 against a TEXT anchor, so the 1.5px wrapper border comes off:
    // -197.5. Getting this wrong by 1.5px is invisible in one photo and
    // obvious in a column of them.
    expect(html).toContain('left:-197.5px');
    expect(html).toContain('top:-7.5px');
    expect(html).toContain('width:168px');
    expect(html).toContain('rotate(-3deg)');
  });

  it('does not apply the border correction to a header float', async () => {
    const html = await render();
    // The header has no border, so $meta floats keep their stored offset.
    expect(html).toContain('left:40px');
    expect(html).toContain('top:10px');
  });

  it('puts a float inside its anchor block, not at the top of the page', async () => {
    // This is the whole no-JavaScript trick: the float is a CHILD of the
    // block it is anchored to, so it moves when the text above it reflows.
    // If it ever ends up as a sibling of the paper, every float on the page
    // silently lands in the wrong place.
    const html = await render();
    const paragraph = html.indexOf('A paragraph');
    const float = html.indexOf('left:-197.5px');
    const closingOfParagraphBlock = html.indexOf('</div>', float);
    expect(paragraph).toBeGreaterThan(-1);
    expect(float).toBeGreaterThan(paragraph);
    expect(closingOfParagraphBlock).toBeGreaterThan(float);
  });

  it('layers a behind-float under the words and a normal one over them', async () => {
    const html = await render();
    expect(html).toContain('z-index:-1');
    expect(html).toContain('z-index:8');
  });

  it('draws half a star as a half fill', async () => {
    const html = await render();
    expect(html).toContain('width:50%');
    expect(html).toContain('Rated 4.5 out of 5');
  });

  it('bleeds a full-bleed banner past the paper padding', async () => {
    const html = await render();
    expect(html).toContain('width:calc(100% + 96px)');
    expect(html).toContain('margin-left:-48px');
    expect(html).toContain('height:300px');
  });

  it('keeps the writer’s inline formatting and drops nothing else', async () => {
    const html = await render();
    expect(html).toContain('A paragraph with <b>bold</b> in it.');
  });

  it('renders the header the editor renders', async () => {
    const html = await render();
    expect(html).toContain('A title');
    expect(html).toContain('A subtitle');
    expect(html).toContain('A cuisine');
    expect(html).toContain('An author');
    // Tags are one comma-separated string in the document, several pills on
    // the page.
    expect(html).toContain('>one<');
    expect(html).toContain('>two<');
  });

  it('renders a document with nothing in it rather than throwing', async () => {
    // A review saved the moment it was created: no meta, one empty flow.
    const html = await render({
      review: { meta: {}, doc: { media: [], styles: {}, flow: [], floats: [] } },
    });
    expect(html).toContain('desk-paper');
  });

  it('survives a float pointing at media that is not there', async () => {
    // Publishing rewrites image sources; a stale index must not take the
    // whole page down with it.
    const html = await render({
      review: {
        meta: {},
        doc: {
          media: [],
          styles: {},
          flow: [{ id: 1, kind: 'text', type: 'body', text: 'x' }],
          floats: [{ id: 2, kind: 'image', anchor: 1, dx: 0, dy: 0, w: 10, h: 10, media: 99 }],
        },
      },
    });
    expect(html).toContain('desk-float');
    expect(html).not.toContain('<img');
  });
});
