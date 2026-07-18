import { GRID_COLUMNS, GRID_COLUMNS_MOBILE, GRID_ROW_HEIGHT } from './block-options.mjs';

// Turns a block's grid coordinates into CSS. Shared by the published page
// (Blocks.astro) and the canvas editor (/admin/arrange), so what a writer
// drags is exactly what a reader gets — the two cannot drift, because
// there is only one implementation.

/** Split blocks into the ones that flow and the ones that are placed. */
export function partitionBlocks(blocks = []) {
  const flowed = [];
  const placed = [];
  for (const block of blocks) {
    (block.layout?.desktop ? placed : flowed).push(block);
  }
  return { flowed, placed };
}

/**
 * Derive a phone layout from a desktop one.
 *
 * Full width, stacked, in READING ORDER — top to bottom, then left to
 * right, which is how someone scans the desktop arrangement. Getting this
 * from the coordinates rather than array order matters: a writer who drags
 * a photo above a paragraph expects the photo first on a phone too, and
 * the array still holds them in the order they were added.
 *
 * Heights are kept, so a block someone made deliberately tall stays tall.
 */
export function deriveMobileLayout(placed) {
  const ordered = [...placed].sort((a, b) => {
    const A = a.layout.desktop;
    const B = b.layout.desktop;
    return A.row - B.row || A.col - B.col;
  });

  let row = 1;
  return new Map(
    ordered.map((block) => {
      const place = {
        col: 1,
        colEnd: GRID_COLUMNS_MOBILE,
        row,
        rowSpan: block.layout.desktop.rowSpan,
        z: 0, // Stacked, so nothing overlaps and z-order is meaningless.
      };
      row += place.rowSpan;
      return [block, place];
    })
  );
}

/** `grid-area` shorthand for one placement. */
function gridArea(place) {
  // CSS grid lines are the edges BETWEEN columns, so a block occupying
  // columns 4..12 spans from line 4 to line 13. Off-by-one here is the
  // classic grid bug: everything renders one column narrow.
  return `${place.row} / ${place.col} / ${place.row + place.rowSpan} / ${place.colEnd + 1}`;
}

/**
 * Inline custom properties for one placed block.
 *
 * Custom properties rather than direct grid-area, so the stylesheet decides
 * WHICH one applies at each breakpoint via a media query. Writing
 * `grid-area` inline would mean the desktop value winning everywhere,
 * because an inline style beats any media query in a stylesheet.
 */
export function placementStyle(block, mobilePlace) {
  const desktop = block.layout.desktop;
  const mobile = block.layout.mobile ?? mobilePlace;

  return [
    `--area-desktop: ${gridArea(desktop)}`,
    `--area-mobile: ${gridArea(mobile)}`,
    `--z: ${desktop.z ?? 0}`,
  ].join('; ');
}

/** The grid container's own styles. */
export function gridStyle() {
  return [
    `--grid-columns: ${GRID_COLUMNS}`,
    `--grid-columns-mobile: ${GRID_COLUMNS_MOBILE}`,
    `--row-height: ${GRID_ROW_HEIGHT}px`,
  ].join('; ');
}
