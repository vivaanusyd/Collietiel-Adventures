// XML escaping for the two hand-rolled feed endpoints (rss.xml.ts,
// sitemap.xml.ts).
//
// Extracted from rss.xml.ts so it can be unit-tested directly. Those
// endpoints import `astro:content` through src/lib/reviews.ts, which only
// resolves inside an Astro build — so a test that imported the endpoint to
// reach this function couldn't run at all. It's also the one piece of the
// feed with a real correctness trap, which makes it exactly the thing worth
// testing (see test/xml.test.ts).

// The five XML predefined entities. Done in ONE regex pass with a lookup so
// `&` can't be double-escaped — a sequential .replace() chain would turn
// "&" into "&amp;amp;", because the & introduced by the first replacement
// gets caught by the next one.
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/** Escape a string for inclusion in XML text or an attribute value. */
export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}
