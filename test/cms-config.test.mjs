import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ALIGNMENTS,
  BLOCK_TYPES,
  EMPHASIS,
  IMAGE_LAYOUTS,
  TEXT_SIZES,
} from '../src/lib/block-options.mjs';

// public/admin/config.yml and src/content/config.ts are one contract, kept
// in two files because one is read by the editor and the other by the build.
// When they disagree, a writer saves something that fails the build, gets an
// error mentioning zod, and cannot fix it themselves — the worst failure
// this setup has, and one nobody notices until a writer hits it.
//
// So: parse the YAML and assert the vocabularies match. Deliberately NOT a
// full YAML parse — pulling in a parser to check a config file would be a
// dependency for a test. The checks below are string-level and would only
// pass by coincidence if the file were malformed in exactly the right way.

const CONFIG = fs.readFileSync(
  fileURLToPath(new URL('../public/admin/config.yml', import.meta.url)),
  'utf8'
);

/**
 * Collect the `value:` of every select option under a given field label.
 *
 * Walks by INDENTATION rather than looking for a delimiter: find the field's
 * `label:` line, find its `options:` line, then take option lines until one
 * dedents back to the options' own level. Blocks nest at several depths in
 * this file, so a fixed-indent delimiter silently ran past the end of a
 * field and swept up the next one's options.
 */
function optionValuesFor(fieldLabel) {
  const lines = CONFIG.split('\n');
  const labelIndex = lines.findIndex((l) => l.trim() === `label: ${fieldLabel}`);
  if (labelIndex === -1) return null;

  const optionsIndex = lines.findIndex((l, i) => i > labelIndex && l.trim() === 'options:');
  if (optionsIndex === -1) return null;

  const indentOf = (line) => line.length - line.trimStart().length;
  const optionsIndent = indentOf(lines[optionsIndex]);

  const values = [];
  for (let i = optionsIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (indentOf(line) <= optionsIndent) break;
    const match = line.match(/value:\s*([A-Za-z0-9_-]+)/);
    if (match) values.push(match[1]);
  }
  return values;
}

describe('CMS config mirrors the content schema', () => {
  it('offers every block type the schema accepts, and no others', () => {
    // Block types appear as `- name: <type>` under the `types:` key.
    const typesSection = CONFIG.slice(CONFIG.indexOf('types_key: type'));
    const declared = BLOCK_TYPES.filter((t) => new RegExp(`- name: ${t}\\b`).test(typesSection));

    expect(declared.sort()).toEqual([...BLOCK_TYPES].sort());
  });

  it('offers exactly the text sizes the stylesheet implements', () => {
    expect(optionValuesFor('Size')).toEqual([...TEXT_SIZES]);
  });

  it('offers exactly the alignments the schema accepts', () => {
    // Two fields are labelled Alignment (text block, quote block); the
    // helper reads the first, and both must offer the same list.
    expect(optionValuesFor('Alignment')).toEqual([...ALIGNMENTS]);
  });

  it('offers exactly the palette slots, and no free colour input', () => {
    expect(optionValuesFor('Colour')).toEqual([...EMPHASIS]);
    // The specific regression this guards: someone "improving" the editor by
    // swapping the select for a colour picker, which would start baking
    // literal hex values into content files and make a redesign impossible.
    expect(CONFIG).not.toMatch(/widget:\s*color/);
  });

  it('offers exactly the image widths the stylesheet implements', () => {
    expect(optionValuesFor('Width')).toEqual([...IMAGE_LAYOUTS]);
  });

  // The verdict badge used to be asserted here. The field is retired — the
  // Sunday Table places reaction stickers in the page instead — so the check
  // is now the opposite one: that it hasn't crept back into the editor while
  // the site has stopped drawing it.
  it('no longer asks writers for a verdict badge the site does not draw', () => {
    expect(CONFIG).not.toMatch(/name:\s*reaction/);
  });
});

describe('CMS config safety rails', () => {
  it('uses the editorial workflow, so writers cannot commit to main', () => {
    expect(CONFIG).toMatch(/publish_mode:\s*editorial_workflow/);
  });

  it('defaults new reviews to draft', () => {
    // A review that reaches the live site because someone forgot a checkbox
    // is the failure this default exists to prevent.
    const draftField = CONFIG.slice(CONFIG.indexOf('label: Keep as a draft'));
    expect(draftField).toMatch(/default:\s*true/);
  });

  it('requires alt text on every image-bearing block', () => {
    // Three blocks carry images: image, gallery, annotated. Each must ask
    // for a description and mark it required.
    const altFields = [
      ...CONFIG.matchAll(/label: Image description\n(\s+)widget: string\n\s+required: (\w+)/g),
    ];
    expect(altFields.length).toBe(3);
    for (const match of altFields) {
      expect(match[2]).toBe('true');
    }
  });

  it('enforces the blurb length limits that the schema also enforces', () => {
    const blurb = CONFIG.slice(CONFIG.indexOf('label: Blurb'));
    expect(blurb).toMatch(/minlength:\s*20/);
    expect(blurb).toMatch(/maxlength:\s*160/);
  });

  it('collects the location with a map picker, never typed coordinates', () => {
    expect(CONFIG).toMatch(/name: location\n\s+label: .*\n\s+widget: map/);
    // lat/lng remain valid in hand-written files, but must not be offered as
    // fields for a writer to type into.
    expect(CONFIG).not.toMatch(/name: lat\b/);
    expect(CONFIG).not.toMatch(/name: lng\b/);
  });

  it('restricts the rating to whole stars 1-5', () => {
    const rating = CONFIG.slice(CONFIG.indexOf('label: Rating'));
    expect(rating).toMatch(/value_type:\s*int/);
    expect(rating).toMatch(/min:\s*1/);
    expect(rating).toMatch(/max:\s*5/);
  });
});
