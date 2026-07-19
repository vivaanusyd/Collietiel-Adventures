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
//
// The chrome (floating toolbar island, bottom dock, selection pill, object
// panel) follows the Claude Design prototype in layout-editor/, rebuilt on
// the grid model: the prototype positions in free pixels with free fonts,
// which is exactly what this site's block system exists to avoid. The look
// and interactions carry over; the coordinates and the styling vocabulary
// stay the site's.

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
  type: 'text' | 'textarea' | 'choice';
  options?: string[];
  placeholder?: string;
  /** One line under the input saying why the field matters. */
  hint?: string;
  /** Render choices as palette swatches rather than word chips. */
  swatches?: Record<string, string>;
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
let panelOpen = false;
let guidesOn = true;
let dirty = false;

/** Undo/redo snapshots, bounded — a long session holding every state is how
    an editor starts to crawl. */
const past: string[] = [];
const future: string[] = [];
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
      type: 'choice',
      options: ['small', 'normal', 'large', 'display'],
    },
    { key: 'align', label: 'Alignment', type: 'choice', options: ['left', 'center'] },
    {
      key: 'emphasis',
      label: 'Colour',
      type: 'choice',
      options: ['default', 'accent', 'muted'],
      // The three palette slots a writer can pick from — swatches show the
      // actual variables, so what they see is what the site renders.
      swatches: {
        default: 'var(--color-text)',
        accent: 'var(--color-accent)',
        muted: 'var(--color-muted)',
      },
      hint: 'From the site palette, so every review still matches the site.',
    },
  ],
  image: [
    { key: 'src', label: 'Image path', type: 'text', placeholder: '/images/reviews/…' },
    {
      key: 'alt',
      label: 'Description (required)',
      type: 'text',
      hint: 'What a screen reader announces instead of the photo.',
    },
    { key: 'caption', label: 'Caption', type: 'text' },
    {
      key: 'width',
      label: 'Width when flowing',
      type: 'choice',
      options: ['full', 'wide', 'normal', 'inset', 'left', 'right'],
    },
  ],
  annotated: [
    { key: 'src', label: 'Image path', type: 'text', placeholder: '/images/reviews/…' },
    {
      key: 'alt',
      label: 'Description (required)',
      type: 'text',
      hint: 'What a screen reader announces instead of the photo.',
    },
    { key: 'caption', label: 'Caption', type: 'text' },
  ],
  quote: [
    { key: 'text', label: 'Quote', type: 'textarea' },
    { key: 'attribution', label: 'Attribution', type: 'text' },
    { key: 'align', label: 'Alignment', type: 'choice', options: ['left', 'center'] },
  ],
  gallery: [],
  dishes: [],
};

/** Editing these arrays needs the main editor's repeatable fields; the
    canvas only places them. Said in the panel so it reads as a boundary,
    not a bug. */
const PANEL_NOTES: Record<string, string> = {
  gallery: 'Add or reorder the photos themselves in the main editor.',
  dishes: 'Add or edit the dishes themselves in the main editor.',
};

const canvas = el<HTMLDivElement>('canvas');
const blocksEl = el<HTMLDivElement>('canvas-blocks');
const gridEl = el<HTMLDivElement>('canvas-grid');
const emptyEl = el<HTMLDivElement>('canvas-empty');
const statusEl = el<HTMLParagraphElement>('status');
const panelEl = el<HTMLElement>('inspector');
const pillEl = el<HTMLDivElement>('pill');
const ghostEl = el<HTMLDivElement>('ghost');
const trashEl = el<HTMLDivElement>('trash');
const saveChipEl = el<HTMLSpanElement>('save-chip');
const saveBtn = el<HTMLButtonElement>('save');
const undoBtn = el<HTMLButtonElement>('undo');
const redoBtn = el<HTMLButtonElement>('redo');
const guidesBtn = el<HTMLButtonElement>('guides');
const selectEl = el<HTMLSelectElement>('review-select');

let toastTimer: ReturnType<typeof setTimeout> | undefined;

function say(message: string, tone = ''): void {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
  statusEl.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => statusEl.classList.remove('is-show'), 3500);
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
// Undo / redo / dirty state
// ---------------------------------------------------------------------

function snapshot(): void {
  if (!current) return;
  past.push(JSON.stringify(current.blocks));
  if (past.length > HISTORY_LIMIT) past.shift();
  future.length = 0;
  syncHistoryButtons();
}

function undo(): void {
  const previous = past.pop();
  if (!previous || !current) return;
  future.push(JSON.stringify(current.blocks));
  current.blocks = JSON.parse(previous) as Block[];
  selected = null;
  panelOpen = false;
  markDirty();
  render();
}

function redo(): void {
  const next = future.pop();
  if (!next || !current) return;
  past.push(JSON.stringify(current.blocks));
  current.blocks = JSON.parse(next) as Block[];
  selected = null;
  panelOpen = false;
  markDirty();
  render();
}

function syncHistoryButtons(): void {
  undoBtn.disabled = past.length === 0;
  redoBtn.disabled = future.length === 0;
}

function markDirty(): void {
  dirty = true;
  saveBtn.disabled = false;
  saveChipEl.textContent = 'Unsaved';
  saveChipEl.dataset.state = 'dirty';
}

function markClean(label: string): void {
  dirty = false;
  saveBtn.disabled = true;
  saveChipEl.textContent = label;
  saveChipEl.dataset.state = 'saved';
}

// ---------------------------------------------------------------------
// Content previews
//
// The canvas shows the block's actual content in the site's own type scale
// and palette — a page you can read, not a diagram of one. Text is shown as
// written (Markdown syntax and all): running the remark pipeline here would
// mean a second copy of it in the browser, and the one bug this editor must
// never have is disagreeing with the site about what a block contains.
// ---------------------------------------------------------------------

function stripedPlaceholder(label: string): HTMLElement {
  const box = document.createElement('div');
  box.className = 'cblock__placeholder';
  const tag = document.createElement('span');
  tag.textContent = label;
  box.append(tag);
  return box;
}

function previewImage(src: string, alt: string): HTMLElement {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.draggable = false;
  return img;
}

function preview(block: Block): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'cblock__content';

  switch (block.type) {
    case 'text': {
      const text = document.createElement('div');
      text.className = `cblock__text is-${block.size ?? 'normal'} is-${block.align ?? 'left'} is-${block.emphasis ?? 'default'}`;
      text.textContent = String(block.body || '');
      if (!block.body) {
        text.textContent = 'Empty text block — open its settings to write.';
        text.classList.add('is-empty');
      }
      wrap.append(text);
      break;
    }
    case 'image':
    case 'annotated': {
      if (block.src) {
        wrap.append(previewImage(String(block.src), String(block.alt ?? '')));
      } else {
        wrap.append(stripedPlaceholder('no image chosen yet'));
      }
      if (block.type === 'annotated') {
        for (const spot of (block.hotspots as { x: number; y: number; label: string }[]) ?? []) {
          const dot = document.createElement('span');
          dot.className = 'cblock__hotspot';
          dot.style.left = `${spot.x}%`;
          dot.style.top = `${spot.y}%`;
          dot.title = spot.label;
          wrap.append(dot);
        }
      }
      if (block.caption) {
        const cap = document.createElement('p');
        cap.className = 'cblock__caption';
        cap.textContent = String(block.caption);
        wrap.append(cap);
      }
      break;
    }
    case 'gallery': {
      const images = (block.images as { src: string; alt: string }[]) ?? [];
      if (!images.length) {
        wrap.append(stripedPlaceholder('empty gallery'));
        break;
      }
      const strip = document.createElement('div');
      strip.className = 'cblock__gallery';
      for (const img of images) strip.append(previewImage(img.src, img.alt));
      wrap.append(strip);
      break;
    }
    case 'quote': {
      const quote = document.createElement('blockquote');
      quote.className = `cblock__quote is-${block.align ?? 'left'}`;
      quote.textContent = String(block.text || '“Empty quote.”');
      wrap.append(quote);
      if (block.attribution) {
        const cite = document.createElement('p');
        cite.className = 'cblock__caption';
        cite.textContent = `— ${block.attribution}`;
        wrap.append(cite);
      }
      break;
    }
    case 'dishes': {
      const items = (block.items as { name: string; price?: string }[]) ?? [];
      if (!items.length) {
        wrap.append(stripedPlaceholder('empty dish list'));
        break;
      }
      const list = document.createElement('ul');
      list.className = 'cblock__dishes';
      for (const item of items) {
        const li = document.createElement('li');
        const name = document.createElement('span');
        name.textContent = item.name;
        li.append(name);
        if (item.price) {
          const price = document.createElement('span');
          price.textContent = item.price;
          li.append(price);
        }
        list.append(li);
      }
      wrap.append(list);
      break;
    }
    default:
      wrap.append(stripedPlaceholder(block.type));
  }

  return wrap;
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

function render(): void {
  gridEl.style.setProperty('--cols', String(columnCount()));
  blocksEl.style.setProperty('--cols', String(columnCount()));
  gridEl.hidden = !guidesOn;
  guidesBtn.setAttribute('aria-pressed', String(guidesOn));
  blocksEl.replaceChildren();
  syncHistoryButtons();
  if (!current) return;

  const { placed } = partitionBlocks(current.blocks);
  emptyEl.hidden = placed.length > 0;

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

    node.append(preview(block));

    const east = document.createElement('span');
    east.className = 'cblock__handle';
    east.dataset.handle = 'e';
    east.title = 'Resize';

    const south = document.createElement('span');
    south.className = 'cblock__handle cblock__handle--s';
    south.dataset.handle = 's';
    south.title = 'Resize';

    // The visible corner knob, same affordance as the prototype — the edge
    // strips still exist for a single-axis resize.
    const corner = document.createElement('span');
    corner.className = 'cblock__knob';
    corner.dataset.handle = 'se';
    corner.title = 'Resize';

    node.append(east, south, corner);
    blocksEl.append(node);
  });

  positionPill();
  renderPanel();
}

/** The floating pill of quick actions above the selected block. */
function positionPill(): void {
  const stale = selected === null || !current?.blocks[selected] || drag !== null;
  pillEl.hidden = stale;
  if (stale) return;

  const node = blocksEl.querySelector<HTMLElement>(`[data-index="${selected}"]`);
  const wrap = pillEl.offsetParent as HTMLElement | null;
  if (!node || !wrap) {
    pillEl.hidden = true;
    return;
  }

  const nodeRect = node.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  pillEl.style.left = `${nodeRect.left - wrapRect.left + nodeRect.width / 2}px`;
  // Above the block, unless that would leave the canvas — then just inside
  // its top edge, where it's still reachable.
  const above = nodeRect.top - wrapRect.top - 14;
  pillEl.style.top = `${Math.max(above, 8)}px`;
}

function selectedBlock(): Block | null {
  return selected === null ? null : (current?.blocks[selected] ?? null);
}

/** A row of word-chips or palette swatches — the constrained picker the
    block model is built around, in place of a raw <select>. */
function choiceRow(field: FieldSpec, block: Block): HTMLElement {
  const row = document.createElement('div');
  row.className = 'panel__choices';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', field.label);

  for (const option of field.options ?? []) {
    const chip = document.createElement('button');
    chip.type = 'button';
    const isCurrent = String(block[field.key] ?? '') === option;
    if (field.swatches) {
      chip.className = 'panel__swatch';
      chip.style.setProperty('--swatch', field.swatches[option]);
      chip.title = option;
      chip.setAttribute('aria-label', option);
    } else {
      chip.className = 'panel__chip';
      chip.textContent = option;
    }
    chip.setAttribute('aria-pressed', String(isCurrent));
    chip.addEventListener('click', () => {
      snapshot();
      block[field.key] = option;
      markDirty();
      render();
    });
    row.append(chip);
  }
  return row;
}

function panelSection(label: string): { section: HTMLElement } {
  const section = document.createElement('div');
  section.className = 'panel__section';
  const caption = document.createElement('div');
  caption.className = 'panel__label';
  caption.textContent = label;
  section.append(caption);
  return { section };
}

function renderPanel(): void {
  const block = selectedBlock();
  if (!panelOpen || !block) {
    panelEl.hidden = true;
    return;
  }

  const place = placementOf(block);
  panelEl.hidden = false;
  panelEl.replaceChildren();

  const head = document.createElement('div');
  head.className = 'panel__head';
  const title = document.createElement('h2');
  title.textContent = block.type;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'panel__close';
  close.textContent = '✕';
  close.setAttribute('aria-label', 'Close settings');
  close.addEventListener('click', () => {
    panelOpen = false;
    renderPanel();
  });
  head.append(title, close);
  panelEl.append(head);

  const body = document.createElement('div');
  body.className = 'panel__body';
  panelEl.append(body);

  if (PANEL_NOTES[block.type]) {
    const note = document.createElement('p');
    note.className = 'panel__note';
    note.textContent = PANEL_NOTES[block.type];
    body.append(note);
  }

  for (const field of FIELDS[block.type] ?? []) {
    const { section } = panelSection(field.label);

    if (field.type === 'choice') {
      section.append(choiceRow(field, block));
    } else {
      let input: HTMLInputElement | HTMLTextAreaElement;
      if (field.type === 'textarea') {
        const area = document.createElement('textarea');
        area.rows = 5;
        input = area;
      } else {
        const text = document.createElement('input');
        text.type = 'text';
        if (field.placeholder) text.placeholder = field.placeholder;
        input = text;
      }
      input.className = 'panel__input';
      input.setAttribute('aria-label', field.label);
      input.value = String(block[field.key] ?? '');
      input.addEventListener('change', () => {
        snapshot();
        block[field.key] = input.value;
        markDirty();
        render();
      });
      section.append(input);
    }

    if (field.hint) {
      const hint = document.createElement('p');
      hint.className = 'panel__hint';
      hint.textContent = field.hint;
      section.append(hint);
    }
    body.append(section);
  }

  // Placement, editable as numbers — the same coordinates dragging writes,
  // for anyone adjusting by keyboard or wanting exact halves and thirds.
  {
    const { section } = panelSection('Placement (grid columns and rows)');
    const grid = document.createElement('div');
    grid.className = 'panel__grid4';
    const specs: [string, () => number, (v: number) => void, number, number][] = [
      [
        'Col',
        () => place.col,
        (v) => {
          const width = place.colEnd - place.col;
          place.col = Math.min(Math.max(1, v), columnCount() - width);
          place.colEnd = place.col + width;
        },
        1,
        columnCount(),
      ],
      [
        'Row',
        () => place.row,
        (v) => {
          place.row = Math.max(1, v);
        },
        1,
        999,
      ],
      [
        'W',
        () => place.colEnd - place.col,
        (v) => {
          place.colEnd = place.col + Math.min(Math.max(1, v), columnCount() - place.col);
        },
        1,
        columnCount(),
      ],
      [
        'H',
        () => place.rowSpan,
        (v) => {
          place.rowSpan = Math.max(1, v);
        },
        1,
        999,
      ],
    ];
    for (const [label, get, set, min, max] of specs) {
      const cell = document.createElement('label');
      cell.className = 'panel__cell';
      const tiny = document.createElement('span');
      tiny.textContent = label;
      const input = document.createElement('input');
      input.className = 'panel__input';
      input.type = 'number';
      input.min = String(min);
      input.max = String(max);
      input.value = String(get());
      input.addEventListener('change', () => {
        snapshot();
        set(Number(input.value) || min);
        markDirty();
        render();
      });
      cell.append(tiny, input);
      grid.append(cell);
    }
    section.append(grid);
    body.append(section);
  }

  // Layering only matters once blocks overlap — which this canvas allows,
  // so it needs a control rather than leaving order to chance.
  {
    const { section } = panelSection('Layer');
    const row = document.createElement('div');
    row.className = 'panel__choices';
    const backward = document.createElement('button');
    backward.type = 'button';
    backward.className = 'panel__chip';
    backward.textContent = '↓ Backward';
    backward.addEventListener('click', () => {
      snapshot();
      place.z = Math.max(0, (place.z ?? 0) - 1);
      markDirty();
      render();
    });
    const level = document.createElement('span');
    level.className = 'panel__level';
    level.textContent = String(place.z ?? 0);
    const forward = document.createElement('button');
    forward.type = 'button';
    forward.className = 'panel__chip';
    forward.textContent = '↑ Forward';
    forward.addEventListener('click', () => {
      snapshot();
      place.z = Math.min(99, (place.z ?? 0) + 1);
      markDirty();
      render();
    });
    row.append(backward, level, forward);
    section.append(row);
    body.append(section);
  }

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'panel__remove';
  remove.textContent = '🗑 Remove block';
  remove.addEventListener('click', () => deleteSelected());
  body.append(remove);
}

// ---------------------------------------------------------------------
// Block actions
// ---------------------------------------------------------------------

function deleteSelected(): void {
  if (selected === null || !current) return;
  snapshot();
  current.blocks.splice(selected, 1);
  selected = null;
  panelOpen = false;
  markDirty();
  render();
  say('Block removed.');
}

function duplicateSelected(): void {
  const block = selectedBlock();
  if (!block || !current) return;
  snapshot();
  const copy = structuredClone(block);
  const place = copy.layout?.desktop;
  if (place) {
    // Offset so the copy is visibly a second block, clamped on the canvas.
    const width = place.colEnd - place.col;
    place.col = Math.min(place.col + 1, GRID_COLUMNS - width);
    place.colEnd = place.col + width;
    place.row += 2;
  }
  delete copy.layout?.mobile; // re-derived; the copy sits elsewhere
  current.blocks.push(copy);
  selected = current.blocks.length - 1;
  markDirty();
  render();
  say('Block duplicated.');
}

// ---------------------------------------------------------------------
// Dragging and resizing
//
// Pointer events, not mouse events: one code path covers mouse, touch and
// stylus, and pointer capture means a fast drag that outruns the element
// still delivers its moves here instead of dropping the block mid-gesture.
//
// While a drag is live, only the dragged node's style is touched — a full
// re-render per pointermove would recreate every <img> on the canvas and
// flicker.
// ---------------------------------------------------------------------

interface DragState {
  index: number;
  handle: string | null;
  startCell: { col: number; row: number };
  origin: Placement;
  pointerId: number;
  node: HTMLElement;
  overTrash: boolean;
}

let drag: DragState | null = null;

/** The last block press, for double-press detection. The pointerdown
    handler calls preventDefault() (to stop text selection and native image
    drags), which also suppresses the browser's derived click/dblclick
    events — so "double-click opens settings" has to be spotted by hand. */
let lastPress: { index: number; time: number } | null = null;

function applyPlacement(node: HTMLElement, place: Placement): void {
  node.style.gridColumn = `${place.col} / ${place.colEnd + 1}`;
  node.style.gridRow = `${place.row} / ${place.row + place.rowSpan}`;
}

function overTrash(event: PointerEvent): boolean {
  const rect = trashEl.getBoundingClientRect();
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
}

blocksEl.addEventListener('pointerdown', (event: PointerEvent) => {
  const target = event.target as HTMLElement | null;
  const node = target?.closest<HTMLElement>('.cblock');
  if (!node || !current) return;

  const index = Number(node.dataset.index);
  selected = index;

  const now = performance.now();
  if (lastPress && lastPress.index === index && now - lastPress.time < 400) {
    panelOpen = true;
  }
  lastPress = { index, time: now };

  const block = current.blocks[index];
  snapshot();

  drag = {
    index,
    handle: target?.dataset.handle ?? null,
    startCell: pointToCell(event.clientX, event.clientY),
    origin: { ...placementOf(block) },
    pointerId: event.pointerId,
    node,
    overTrash: false,
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

  if (drag.handle === 'e' || drag.handle === 'se') {
    // Minimum one column — a zero-width block would be invisible and
    // unrecoverable without going through the settings panel.
    place.colEnd = Math.min(columnCount(), Math.max(drag.origin.col, drag.origin.colEnd + dCol));
  }
  if (drag.handle === 's' || drag.handle === 'se') {
    place.rowSpan = Math.max(1, drag.origin.rowSpan + dRow);
  }
  if (!drag.handle) {
    // Move: width is preserved, and the block is kept fully on the canvas,
    // so dragging toward an edge stops rather than clipping.
    const width = drag.origin.colEnd - drag.origin.col;
    const col = Math.min(Math.max(1, drag.origin.col + dCol), columnCount() - width);
    place.col = col;
    place.colEnd = col + width;
    place.row = Math.max(1, drag.origin.row + dRow);

    // Only a MOVE can end in the trash — releasing a resize over it because
    // the toolbar happened to be under the pointer would be a rude surprise.
    drag.overTrash = overTrash(event);
    trashEl.classList.toggle('is-armed', drag.overTrash);
    drag.node.classList.toggle('is-doomed', drag.overTrash);
  }

  applyPlacement(drag.node, place);
  pillEl.hidden = true;
  markDirty();
});

function endDrag(event: PointerEvent): void {
  if (!drag) return;
  if (drag.node.hasPointerCapture(event.pointerId)) {
    drag.node.releasePointerCapture(event.pointerId);
  }
  const doomed = drag.overTrash;
  trashEl.classList.remove('is-armed');
  drag = null;
  if (doomed) {
    deleteSelected();
    return;
  }
  render();
}

blocksEl.addEventListener('pointerup', endDrag);
blocksEl.addEventListener('pointercancel', endDrag);

// Keyboard nudging. A canvas drivable only by pointer is unusable for
// anyone who can't use one precisely — and it's faster for everyone when
// adjusting by a single column.
document.addEventListener('keydown', (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null;
  const typing = target?.matches('input, textarea, select') ?? false;
  const mod = event.metaKey || event.ctrlKey;

  if (mod && event.key.toLowerCase() === 'z') {
    if (typing) return; // don't steal undo from a text field
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if (mod && event.key.toLowerCase() === 'y') {
    if (typing) return;
    event.preventDefault();
    redo();
    return;
  }

  if (selected === null || !current || typing) return;

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
      deleteSelected();
      return;
    case 'Enter':
      panelOpen = true;
      break;
    case 'Escape':
      if (panelOpen) panelOpen = false;
      else selected = null;
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
//
// A floating strip along the bottom, as in the prototype. Press a tool and
// DRAG onto the page to place the block where you drop it — a ghost follows
// the pointer so the gesture reads as carrying something. A plain click (or
// Enter/Space) still adds the block below existing work, so the dock is
// fully usable without a pointer.
// ---------------------------------------------------------------------

interface SpawnState {
  kind: BlockKind;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
}

let spawn: SpawnState | null = null;

function buildDock(): void {
  const items = el<HTMLDivElement>('dock-items');

  for (const kind of BLOCK_KINDS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dock__item';
    button.dataset.type = kind.type;
    button.title = `${kind.label} — drag onto the page`;
    button.setAttribute('aria-label', `Add ${kind.label.toLowerCase()} block`);

    const icon = document.createElement('span');
    icon.className = 'dock__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = kind.icon;

    const label = document.createElement('span');
    label.className = 'dock__label';
    label.textContent = kind.label;

    button.append(icon, label);
    button.addEventListener('pointerdown', (event: PointerEvent) => {
      spawn = {
        kind,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };
      event.preventDefault();
    });
    button.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        addBlock(kind);
      }
    });
    items.append(button);
  }

  const lip = el<HTMLButtonElement>('dock-lip');
  lip.addEventListener('click', () => {
    const min = el<HTMLElement>('dock').classList.toggle('is-min');
    lip.setAttribute('aria-expanded', String(!min));
  });
}

window.addEventListener('pointermove', (event: PointerEvent) => {
  if (!spawn || event.pointerId !== spawn.pointerId) return;
  if (!spawn.moved) {
    // A dead-zone so a twitchy click doesn't read as a drag.
    if (Math.hypot(event.clientX - spawn.startX, event.clientY - spawn.startY) < 6) return;
    spawn.moved = true;
    ghostEl.hidden = false;
    ghostEl.textContent = `${spawn.kind.icon} ${spawn.kind.label}`;
  }
  ghostEl.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
});

window.addEventListener('pointerup', (event: PointerEvent) => {
  if (!spawn || event.pointerId !== spawn.pointerId) return;
  const { kind, moved } = spawn;
  spawn = null;
  ghostEl.hidden = true;

  if (!moved) {
    addBlock(kind); // a click, not a drag
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const onCanvas =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;
  if (!onCanvas) {
    say('Dropped outside the page — nothing added.');
    return;
  }
  addBlock(kind, pointToCell(event.clientX, event.clientY));
});

window.addEventListener('pointercancel', () => {
  spawn = null;
  ghostEl.hidden = true;
});

function addBlock(kind: BlockKind, at?: { col: number; row: number }): void {
  if (!current) return;
  snapshot();

  const [col, colEnd, rowSpan] = kind.span;
  const width = colEnd - col;

  let placement: Placement;
  if (at) {
    // Centred on the drop point, clamped to the canvas.
    const c = Math.min(Math.max(1, at.col - Math.floor(width / 2)), columnCount() - width);
    placement = { col: c, colEnd: c + width, row: Math.max(1, at.row - 1), rowSpan, z: 0 };
  } else {
    // Placed BELOW everything already on the canvas, rather than at the
    // top-left where it would land on top of existing work.
    const lowest = current.blocks.reduce((max, b) => {
      const p = b.layout?.desktop;
      return p ? Math.max(max, p.row + p.rowSpan) : max;
    }, 1);
    placement = { col, colEnd: Math.min(colEnd, columnCount()), row: lowest, rowSpan, z: 0 };
  }

  const block: Block = { type: kind.type, layout: { desktop: placement } };

  // The schema's field names with empty starting values. NOT yet valid —
  // most block types require real content (an image path, alt text, at
  // least one dish) before the build accepts them, which is why save()
  // runs unfinished() and says what's missing in plain words.
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
  panelOpen = true;
  markDirty();
  render();
  say(`Added a ${kind.label.toLowerCase()} block.`);

  // The pop-in, matching the prototype. A class, so reduced-motion's global
  // override in global.css applies to it like everything else.
  const node = blocksEl.querySelector<HTMLElement>(`[data-index="${selected}"]`);
  node?.classList.add('is-new');
}

// ---------------------------------------------------------------------
// The selection pill
// ---------------------------------------------------------------------

function buildPill(): void {
  const actions: [string, string, () => void][] = [
    [
      '⚙',
      'Block settings',
      () => {
        panelOpen = true;
        render();
      },
    ],
    ['⧉', 'Duplicate block', duplicateSelected],
    [
      '↑',
      'Bring forward',
      () => {
        const block = selectedBlock();
        if (!block) return;
        snapshot();
        const place = placementOf(block);
        place.z = Math.min(99, (place.z ?? 0) + 1);
        markDirty();
        render();
      },
    ],
    [
      '↓',
      'Send backward',
      () => {
        const block = selectedBlock();
        if (!block) return;
        snapshot();
        const place = placementOf(block);
        place.z = Math.max(0, (place.z ?? 0) - 1);
        markDirty();
        render();
      },
    ],
    ['🗑', 'Delete block', deleteSelected],
  ];

  for (const [glyph, label, run] of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pill__btn';
    button.textContent = glyph;
    button.title = label;
    button.setAttribute('aria-label', label);
    // pointerdown, so the canvas's own pointerdown (which would deselect or
    // start a drag) never sees the event first.
    button.addEventListener('pointerdown', (event) => event.stopPropagation());
    button.addEventListener('click', run);
    pillEl.append(button);
  }
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
  panelOpen = false;
  past.length = 0;
  future.length = 0;
  markClean('Saved');

  const { placed } = partitionBlocks(current.blocks);
  say(
    placed.length
      ? `${placed.length} block(s) on the canvas.`
      : 'Nothing placed yet — drag a block up from the dock.'
  );
  render();
}

/**
 * What still needs filling in before the build would accept these blocks.
 *
 * Mirrors the hard requirements in src/lib/blocks.ts, in words a writer can
 * act on rather than a zod path. Checked at save because that's the moment
 * the blocks leave this tool — a warning here beats a red build on the pull
 * request, which is the failure mode a writer can't fix alone.
 */
function unfinished(blocks: Block[]): string[] {
  const problems: string[] = [];
  const imageOk = (src: unknown): boolean => typeof src === 'string' && src.startsWith('/images/');

  blocks.forEach((block, i) => {
    const where = `Block ${i + 1} (${block.type})`;
    if (block.type === 'image' || block.type === 'annotated') {
      if (!imageOk(block.src)) problems.push(`${where} has no image chosen.`);
      if (!block.alt) problems.push(`${where} has no description (alt text).`);
    }
    if (block.type === 'annotated' && !((block.hotspots as unknown[]) ?? []).length) {
      problems.push(`${where} has no labelled pins yet.`);
    }
    if (block.type === 'gallery') {
      const images = (block.images as { src: string; alt: string }[]) ?? [];
      if (images.length < 2 || images.length > 3) {
        problems.push(`${where} needs two or three photos (it has ${images.length}).`);
      } else {
        for (const img of images) {
          if (!imageOk(img.src) || !img.alt) {
            problems.push(`${where} has a photo without an image or description.`);
            break;
          }
        }
      }
    }
    if (block.type === 'quote' && !block.text) problems.push(`${where} is empty.`);
    if (block.type === 'dishes' && !((block.items as unknown[]) ?? []).length) {
      problems.push(`${where} has no dishes yet.`);
    }
  });

  return problems;
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

  const problems = unfinished(current.blocks);

  navigator.clipboard?.writeText(json).then(
    () => {
      if (problems.length) {
        // Copied anyway — an arrangement-in-progress is legitimate, and the
        // content can be finished in the main editor. But say so, because
        // published as-is these blocks would fail the build.
        say(
          `Copied, but not finished: ${problems[0]}${problems.length > 1 ? ` (+${problems.length - 1} more — see the browser console.)` : ''}`,
          'error'
        );
        console.warn('[arrange] unfinished blocks:\n' + problems.join('\n'));
        markClean('Copied — unfinished');
      } else {
        say('Arrangement copied. Paste it into the review in the editor.', 'ok');
        markClean('Copied ✓');
      }
    },
    () => say('Could not copy — the arrangement is in the browser console.', 'error')
  );
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
    panelOpen = false;
    render();
    say(
      viewport === 'mobile'
        ? 'Editing the phone layout. Blocks start from the automatic stack — move one and it becomes deliberate.'
        : 'Editing the desktop layout.'
    );
  });
}

undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);
saveBtn.addEventListener('click', save);
guidesBtn.addEventListener('click', () => {
  guidesOn = !guidesOn;
  render();
});

// Clicking empty canvas deselects, so the settings panel doesn't stay
// pinned to a block you've mentally moved on from.
canvas.addEventListener('pointerdown', (event: PointerEvent) => {
  const target = event.target as HTMLElement;
  if (target === canvas || target === gridEl || target === blocksEl) {
    selected = null;
    panelOpen = false;
    render();
  }
});

window.addEventListener('beforeunload', (event: BeforeUnloadEvent) => {
  if (dirty) event.preventDefault();
});

buildDock();
buildPill();
void load();
