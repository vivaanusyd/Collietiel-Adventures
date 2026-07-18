import { GRID_COLUMNS, GRID_COLUMNS_MOBILE, GRID_ROW_HEIGHT } from '../lib/block-options.mjs';
import { deriveMobileLayout, partitionBlocks } from '../lib/layout.mjs';

// The canvas editor's behaviour. The markup and styles are in
// src/pages/admin/arrange.astro; this is a module rather than an inline
// script so it's type-checked like everything else — an editor that
// silently corrupts a writer's arrangement is worse than one that doesn't
// exist, and the types are the cheapest guard against that.
//
// It imports the SAME grid constants and layout maths the published page
// uses, so the canvas cannot disagree with the site about where a block
// sits.

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

interface Placement {
  col: number;
  colEnd: number;
  row: number;
  rowSpan: number;
  z: number;
}

interface Layout {
  desktop: Placement;
  mobile?: Placement;
}

interface Block {
  type: string;
  layout?: Layout;
  [key: string]: unknown;
}

interface Review {
  slug: string;
  name: string;
  draft: boolean;
  cover: string | null;
  blocks: Block[];
}

type Viewport = 'desktop' | 'mobile';

interface BlockKind {
  type: string;
  label: string;
  icon: string;
  /** [col, colEnd, rowSpan] a new block of this type starts at. */
  span: [number, number, number];
}

interface FieldSpec {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
  placeholder?: string;
}

/** Element by id, or throw. These all exist in arrange.astro's markup, so a
    miss is a developer error worth failing loudly rather than a state to
    handle at every call site. */
function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`[arrange] missing #${id}`);
  return found as T;
}

// ---------------------------------------------------------------------
// State
// ---------------------------------------------------------------------

let reviews: Review[] = [];
let current: Review | null = null;
let viewport: Viewport = 'desktop';
let selected: number | null = null;
let dirty = false;

/** Undo snapshots, bounded — a long session holding every state is how an
    editor starts to crawl. */
const history: string[] = [];
const HISTORY_LIMIT = 50;

const BLOCK_KINDS: BlockKind[] = [
  { type: 'text', label: 'Text', icon: '¶', span: [1, 12, 6] },
  { type: 'image', label: 'Image', icon: '▣', span: [1, 12, 10] },
  { type: 'gallery', label: 'Gallery', icon: '▤', span: [1, 24, 8] },
  { type: 'annotated', label: 'Annotated', icon: '◎', span: [1, 14, 10] },
  { type: 'quote', label: 'Quote', icon: '❝', span: [3, 22, 4] },
  { type: 'dishes', label: 'Dishes', icon: '☰', span: [1, 12, 8] },
];

const FIELDS: Record<string, FieldSpec[]> = {
  text: [
    { key: 'body', label: 'Text', type: 'textarea' },
    {
      key: 'size',
      label: 'Size',
      type: 'select',
      options: ['small', 'normal', 'large', 'display'],
    },
    { key: 'align', label: 'Alignment', type: 'select', options: ['left', 'center'] },
    {
      key: 'emphasis',
      label: 'Colour',
      type: 'select',
      options: ['default', 'accent', 'muted'],
    },
  ],
  image: [
    { key: 'src', label: 'Image path', type: 'text', placeholder: '/images/reviews/…' },
    { key: 'alt', label: 'Description (required)', type: 'text' },
    { key: 'caption', label: 'Caption', type: 'text' },
    {
      key: 'width',
      label: 'Width when flowing',
      type: 'select',
      options: ['full', 'wide', 'normal', 'inset', 'left', 'right'],
    },
  ],
  annotated: [
    { key: 'src', label: 'Image path', type: 'text', placeholder: '/images/reviews/…' },
    { key: 'alt', label: 'Description (required)', type: 'text' },
    { key: 'caption', label: 'Caption', type: 'text' },
  ],
  quote: [
    { key: 'text', label: 'Quote', type: 'textarea' },
    { key: 'attribution', label: 'Attribution', type: 'text' },
    { key: 'align', label: 'Alignment', type: 'select', options: ['left', 'center'] },
  ],
  gallery: [],
  dishes: [],
};

const canvas = el<HTMLDivElement>('canvas');
const blocksEl = el<HTMLDivElement>('canvas-blocks');
const gridEl = el<HTMLDivElement>('canvas-grid');
const statusEl = el<HTMLParagraphElement>('status');
const inspectorEl = el<HTMLElement>('inspector');
const saveBtn = el<HTMLButtonElement>('save');
const undoBtn = el<HTMLButtonElement>('undo');
const selectEl = el<HTMLSelectElement>('review-select');

function say(message: string, tone = ''): void {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

// ---------------------------------------------------------------------
// Grid maths
//
// The editor thinks in COLUMNS and ROWS, never pixels — same as the
// published page. Pixels appear only to turn a pointer position into a
// coordinate, and immediately turn back.
// ---------------------------------------------------------------------

const columnCount = (): number => (viewport === 'mobile' ? GRID_COLUMNS_MOBILE : GRID_COLUMNS);

/** Pointer position -> {col, row}, clamped to the canvas. */
function pointToCell(clientX: number, clientY: number): { col: number; row: number } {
  const rect = canvas.getBoundingClientRect();
  const colWidth = rect.width / columnCount();
  const col = Math.floor((clientX - rect.left) / colWidth) + 1;
  const row = Math.floor((clientY - rect.top) / GRID_ROW_HEIGHT) + 1;
  return {
    col: Math.min(Math.max(col, 1), columnCount()),
    row: Math.max(row, 1),
  };
}

/** The placement currently being edited for a block, creating one if needed. */
function placementOf(block: Block): Placement {
  block.layout ??= { desktop: { col: 1, colEnd: 12, row: 1, rowSpan: 6, z: 0 } };

  if (viewport === 'desktop') return block.layout.desktop;

  // Editing mobile for the first time seeds from the DERIVED stack, so a
  // writer starts from the automatic layout and adjusts it — rather than
  // from every block piled in the top-left corner.
  if (!block.layout.mobile) {
    const placed = (current?.blocks ?? []).filter((b) => b.layout?.desktop);
    const derived = deriveMobileLayout(placed).get(block) as Placement | undefined;
    block.layout.mobile = derived ?? {
      col: 1,
      colEnd: GRID_COLUMNS_MOBILE,
      row: 1,
      rowSpan: 6,
      z: 0,
    };
  }
  return block.layout.mobile;
}

// ---------------------------------------------------------------------
// Undo / dirty state
// ---------------------------------------------------------------------

function snapshot(): void {
  if (!current) return;
  history.push(JSON.stringify(current.blocks));
  if (history.length > HISTORY_LIMIT) history.shift();
  undoBtn.disabled = history.length === 0;
}

function undo(): void {
  const previous = history.pop();
  if (!previous || !current) return;
  current.blocks = JSON.parse(previous) as Block[];
  selected = null;
  undoBtn.disabled = history.length === 0;
  markDirty();
  render();
}

function markDirty(): void {
  dirty = true;
  saveBtn.disabled = false;
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

function summarise(block: Block): string {
  switch (block.type) {
    case 'text':
      return String(block.body || 'Empty text').slice(0, 120);
    case 'image':
    case 'annotated':
      return String(block.src || 'No image chosen');
    case 'gallery':
      return `${(block.images as unknown[])?.length ?? 0} images`;
    case 'quote':
      return String(block.text || 'Empty quote');
    case 'dishes':
      return `${(block.items as unknown[])?.length ?? 0} dishes`;
    default:
      return block.type;
  }
}

function render(): void {
  gridEl.style.setProperty('--cols', String(columnCount()));
  blocksEl.style.setProperty('--cols', String(columnCount()));
  blocksEl.replaceChildren();
  if (!current) return;

  current.blocks.forEach((block, index) => {
    if (!block.layout?.desktop) return; // still flowing, not on the canvas

    const place = placementOf(block);
    const node = document.createElement('div');
    node.className = 'cblock';
    node.dataset.index = String(index);
    node.dataset.type = block.type;
    if (index === selected) node.classList.add('is-selected');

    node.style.gridColumn = `${place.col} / ${place.colEnd + 1}`;
    node.style.gridRow = `${place.row} / ${place.row + place.rowSpan}`;
    node.style.zIndex = String(place.z ?? 0);

    const kind = BLOCK_KINDS.find((k) => k.type === block.type);

    const icon = document.createElement('span');
    icon.className = 'cblock__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = kind ? kind.icon : '?';

    // textContent, never innerHTML — a writer's prose is not markup, and
    // this is the one place their text is rendered into the editor's DOM.
    const label = document.createElement('span');
    label.className = 'cblock__label';
    label.textContent = summarise(block);

    const east = document.createElement('span');
    east.className = 'cblock__handle';
    east.dataset.handle = 'e';
    east.title = 'Resize';

    const south = document.createElement('span');
    south.className = 'cblock__handle cblock__handle--s';
    south.dataset.handle = 's';
    south.title = 'Resize';

    node.append(icon, label, east, south);
    blocksEl.append(node);
  });

  renderInspector();
}

function renderInspector(): void {
  if (selected === null || !current?.blocks[selected]) {
    inspectorEl.hidden = true;
    return;
  }

  const block = current.blocks[selected];
  const place = placementOf(block);
  inspectorEl.hidden = false;
  inspectorEl.replaceChildren();

  const title = document.createElement('h2');
  title.textContent = block.type;
  inspectorEl.append(title);

  for (const field of FIELDS[block.type] ?? []) {
    const row = document.createElement('label');
    row.className = 'insp__row';
    const caption = document.createElement('span');
    caption.textContent = field.label;
    row.append(caption);

    let input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

    if (field.type === 'select') {
      const select = document.createElement('select');
      for (const option of field.options ?? []) {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        select.append(opt);
      }
      input = select;
    } else if (field.type === 'textarea') {
      const area = document.createElement('textarea');
      area.rows = 4;
      input = area;
    } else {
      const text = document.createElement('input');
      text.type = 'text';
      if (field.placeholder) text.placeholder = field.placeholder;
      input = text;
    }

    input.value = String(block[field.key] ?? '');
    input.addEventListener('change', () => {
      snapshot();
      block[field.key] = input.value;
      markDirty();
      render();
    });

    row.append(input);
    inspectorEl.append(row);
  }

  // Layering only matters once blocks overlap — which this canvas allows,
  // so it needs a control rather than leaving order to chance.
  const zRow = document.createElement('label');
  zRow.className = 'insp__row';
  const zCaption = document.createElement('span');
  zCaption.textContent = 'Layer (higher = in front)';
  const zInput = document.createElement('input');
  zInput.type = 'number';
  zInput.min = '0';
  zInput.max = '99';
  zInput.value = String(place.z ?? 0);
  zInput.addEventListener('change', () => {
    snapshot();
    place.z = Math.max(0, Math.min(99, Number(zInput.value) || 0));
    markDirty();
    render();
  });
  zRow.append(zCaption, zInput);
  inspectorEl.append(zRow);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'insp__remove';
  remove.textContent = 'Remove block';
  remove.addEventListener('click', () => {
    if (selected === null || !current) return;
    snapshot();
    current.blocks.splice(selected, 1);
    selected = null;
    markDirty();
    render();
  });
  inspectorEl.append(remove);
}

// ---------------------------------------------------------------------
// Dragging and resizing
//
// Pointer events, not mouse events: one code path covers mouse, touch and
// stylus, and pointer capture means a fast drag that outruns the element
// still delivers its moves here instead of dropping the block mid-gesture.
// ---------------------------------------------------------------------

interface DragState {
  index: number;
  handle: string | null;
  startCell: { col: number; row: number };
  origin: Placement;
  pointerId: number;
  node: HTMLElement;
}

let drag: DragState | null = null;

blocksEl.addEventListener('pointerdown', (event: PointerEvent) => {
  const target = event.target as HTMLElement | null;
  const node = target?.closest<HTMLElement>('.cblock');
  if (!node || !current) return;

  const index = Number(node.dataset.index);
  selected = index;

  const block = current.blocks[index];
  snapshot();

  drag = {
    index,
    handle: target?.dataset.handle ?? null,
    startCell: pointToCell(event.clientX, event.clientY),
    origin: { ...placementOf(block) },
    pointerId: event.pointerId,
    node,
  };

  node.setPointerCapture(event.pointerId);
  event.preventDefault();
  render();
});

blocksEl.addEventListener('pointermove', (event: PointerEvent) => {
  if (!drag || !current) return;

  const place = placementOf(current.blocks[drag.index]);
  const cell = pointToCell(event.clientX, event.clientY);
  const dCol = cell.col - drag.startCell.col;
  const dRow = cell.row - drag.startCell.row;

  if (drag.handle === 'e') {
    // Minimum one column — a zero-width block would be invisible and
    // unrecoverable without going through the inspector.
    place.colEnd = Math.min(columnCount(), Math.max(drag.origin.col, drag.origin.colEnd + dCol));
  } else if (drag.handle === 's') {
    place.rowSpan = Math.max(1, drag.origin.rowSpan + dRow);
  } else {
    // Move: width is preserved, and the block is kept fully on the canvas,
    // so dragging toward an edge stops rather than clipping.
    const width = drag.origin.colEnd - drag.origin.col;
    const col = Math.min(Math.max(1, drag.origin.col + dCol), columnCount() - width);
    place.col = col;
    place.colEnd = col + width;
    place.row = Math.max(1, drag.origin.row + dRow);
  }

  markDirty();
  render();
});

function endDrag(event: PointerEvent): void {
  if (!drag) return;
  if (drag.node.hasPointerCapture(event.pointerId)) {
    drag.node.releasePointerCapture(event.pointerId);
  }
  drag = null;
}

blocksEl.addEventListener('pointerup', endDrag);
blocksEl.addEventListener('pointercancel', endDrag);

// Keyboard nudging. A canvas drivable only by pointer is unusable for
// anyone who can't use one precisely — and it's faster for everyone when
// adjusting by a single column.
document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (selected === null || !current) return;
  const target = event.target as HTMLElement | null;
  if (target?.matches('input, textarea, select')) return;

  const place = placementOf(current.blocks[selected]);
  const step = event.shiftKey ? 4 : 1;
  let handled = true;

  switch (event.key) {
    case 'ArrowLeft': {
      const width = place.colEnd - place.col;
      place.col = Math.max(1, place.col - step);
      place.colEnd = place.col + width;
      break;
    }
    case 'ArrowRight': {
      const width = place.colEnd - place.col;
      place.col = Math.min(columnCount() - width, place.col + step);
      place.colEnd = place.col + width;
      break;
    }
    case 'ArrowUp':
      place.row = Math.max(1, place.row - step);
      break;
    case 'ArrowDown':
      place.row += step;
      break;
    case 'Backspace':
    case 'Delete':
      snapshot();
      current.blocks.splice(selected, 1);
      selected = null;
      break;
    case 'Escape':
      selected = null;
      break;
    default:
      handled = false;
  }

  if (handled) {
    event.preventDefault();
    markDirty();
    render();
  }
});

// ---------------------------------------------------------------------
// The dock
// ---------------------------------------------------------------------

function buildDock(): void {
  const items = el<HTMLDivElement>('dock-items');

  for (const kind of BLOCK_KINDS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dock__item';
    button.dataset.type = kind.type;

    const icon = document.createElement('span');
    icon.className = 'dock__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = kind.icon;

    const label = document.createElement('span');
    label.textContent = kind.label;

    button.append(icon, label);
    button.addEventListener('click', () => addBlock(kind));
    items.append(button);
  }

  const pin = el<HTMLButtonElement>('dock-pin');
  pin.addEventListener('click', () => {
    const pinned = el<HTMLElement>('dock').classList.toggle('is-pinned');
    pin.setAttribute('aria-pressed', String(pinned));
  });
}

function addBlock(kind: BlockKind): void {
  if (!current) return;
  snapshot();

  const [col, colEnd, rowSpan] = kind.span;

  // Placed BELOW everything already on the canvas, rather than at the
  // top-left where it would land on top of existing work.
  const lowest = current.blocks.reduce((max, b) => {
    const p = b.layout?.desktop;
    return p ? Math.max(max, p.row + p.rowSpan) : max;
  }, 1);

  const block: Block = {
    type: kind.type,
    layout: { desktop: { col, colEnd, row: lowest, rowSpan, z: 0 } },
  };

  // Schema-matching defaults, so a newly added block is valid the moment
  // it's saved rather than failing the build later with a zod error the
  // writer can't act on.
  if (kind.type === 'text') {
    Object.assign(block, { body: '', size: 'normal', align: 'left', emphasis: 'default' });
  } else if (kind.type === 'image') {
    Object.assign(block, { src: '', alt: '', width: 'normal' });
  } else if (kind.type === 'annotated') {
    Object.assign(block, { src: '', alt: '', hotspots: [] });
  } else if (kind.type === 'gallery') {
    Object.assign(block, { images: [] });
  } else if (kind.type === 'quote') {
    Object.assign(block, { text: '', align: 'left' });
  } else if (kind.type === 'dishes') {
    Object.assign(block, { items: [] });
  }

  current.blocks.push(block);
  selected = current.blocks.length - 1;
  markDirty();
  render();
  say(`Added a ${kind.label.toLowerCase()} block. Drag it where you want it.`);
}

// ---------------------------------------------------------------------
// Loading and saving
// ---------------------------------------------------------------------

async function load(): Promise<void> {
  try {
    const response = await fetch('/admin/reviews.json', { cache: 'no-store' });
    reviews = (await response.json()) as Review[];
  } catch {
    say('Could not load reviews.', 'error');
    return;
  }

  selectEl.replaceChildren();
  for (const review of reviews) {
    const option = document.createElement('option');
    option.value = review.slug;
    option.textContent = review.name + (review.draft ? ' (draft)' : '');
    selectEl.append(option);
  }

  selectEl.addEventListener('change', () => selectReview(selectEl.value));

  if (reviews.length) selectReview(reviews[0].slug);
  else say('No reviews yet. Create one in the editor first.', 'error');
}

function selectReview(slug: string): void {
  if (dirty && !confirm('Discard unsaved changes to this arrangement?')) return;

  const found = reviews.find((r) => r.slug === slug);
  if (!found) return;

  current = structuredClone(found);
  selected = null;
  history.length = 0;
  dirty = false;
  saveBtn.disabled = true;
  undoBtn.disabled = true;

  const { placed } = partitionBlocks(current.blocks);
  say(
    placed.length
      ? `${placed.length} block(s) on the canvas.`
      : 'Nothing placed yet — hover the dock on the left and add something.'
  );
  render();
}

/**
 * Hand the arrangement back to the writer.
 *
 * Deliberately stops at producing the exact `blocks:` value rather than
 * committing to GitHub itself. A direct commit would need this page to run
 * its own OAuth flow and its own pull-request logic — a second, half-built
 * publishing path alongside the one Sveltia already does properly. Copying
 * out is the honest seam between the two tools until the canvas can live
 * inside the CMS. See NOTES-FOR-VIVAAN.md.
 */
function save(): void {
  if (!current) return;

  const json = JSON.stringify(current.blocks, null, 2);
  console.log(`[arrange] blocks for ${current.slug}\n${json}`);

  navigator.clipboard?.writeText(json).then(
    () => say('Arrangement copied. Paste it into the review in the editor.', 'ok'),
    () => say('Could not copy — the arrangement is in the browser console.', 'error')
  );

  dirty = false;
  saveBtn.disabled = true;
}

// ---------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-viewport]')) {
  button.addEventListener('click', () => {
    viewport = (button.dataset.viewport as Viewport) ?? 'desktop';
    for (const other of document.querySelectorAll<HTMLButtonElement>('[data-viewport]')) {
      other.classList.toggle('is-active', other === button);
    }
    canvas.dataset.viewport = viewport;
    selected = null;
    render();
    say(
      viewport === 'mobile'
        ? 'Editing the phone layout. Blocks start from the automatic stack — move one and it becomes deliberate.'
        : 'Editing the desktop layout.'
    );
  });
}

undoBtn.addEventListener('click', undo);
saveBtn.addEventListener('click', save);

// Clicking empty canvas deselects, so the inspector doesn't stay pinned to
// a block you've mentally moved on from.
canvas.addEventListener('pointerdown', (event: PointerEvent) => {
  const target = event.target as HTMLElement;
  if (target === canvas || target === gridEl) {
    selected = null;
    render();
  }
});

window.addEventListener('beforeunload', (event: BeforeUnloadEvent) => {
  if (dirty) event.preventDefault();
});

buildDock();
void load();
