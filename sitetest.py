#!/usr/bin/env python3
"""Static-site checker for the built dist/ folder.

Checks the things that actually break a small content site: broken internal
links, missing assets, malformed feed/sitemap XML, wrong canonical URLs,
missing alt text, heading structure, and draft leakage.
"""
import os, re, sys, html
from html.parser import HTMLParser
import xml.etree.ElementTree as ET
from urllib.parse import urlparse, unquote

DIST = sys.argv[1] if len(sys.argv) > 1 else "dist"
SITE = sys.argv[2] if len(sys.argv) > 2 else "https://collietiel-adventures.netlify.app"

fails, warns, notes = [], [], []
def fail(c, m): fails.append((c, m))
def warn(c, m): warns.append((c, m))
def note(m): notes.append(m)


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.imgs, self.headings = [], [], []
        self.metas, self.title, self._intitle = {}, None, False
        self.links_rel = {}
        self.lang = None
        self.h_stack = []
        self._cur_h = None
        self._stack = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag not in ("img", "meta", "link", "br", "hr", "input"):
            self._stack.append((tag, a.get("class", "")))
        if tag == "html":
            self.lang = a.get("lang")
        elif tag == "a" and "href" in a:
            self.links.append(a["href"])
        elif tag == "img":
            # Record the ancestor classes so we can tell whether some
            # container is already reserving space for this image.
            a["_ancestors"] = " ".join(c for _, c in self._stack)
            self.imgs.append(a)
        elif tag == "title":
            self._intitle = True
        elif tag == "meta":
            k = a.get("name") or a.get("property")
            if k:
                self.metas[k] = a.get("content", "")
        elif tag == "link":
            rel = a.get("rel", "")
            self.links_rel.setdefault(rel, []).append(a.get("href", ""))
        elif re.fullmatch(r"h[1-6]", tag):
            self._cur_h = (int(tag[1]), "")

    def handle_endtag(self, tag):
        for i in range(len(self._stack) - 1, -1, -1):
            if self._stack[i][0] == tag:
                del self._stack[i:]
                break
        if tag == "title":
            self._intitle = False
        elif re.fullmatch(r"h[1-6]", tag) and self._cur_h:
            self.headings.append(self._cur_h)
            self._cur_h = None

    def handle_data(self, d):
        if self._intitle:
            self.title = (self.title or "") + d
        if self._cur_h:
            self._cur_h = (self._cur_h[0], self._cur_h[1] + d)


def parse(path):
    p = Page()
    with open(path, encoding="utf-8") as f:
        p.feed(f.read())
    return p


# ---------- collect pages ----------
pages = {}
for root, _, files in os.walk(DIST):
    for fn in files:
        if fn.endswith(".html"):
            full = os.path.join(root, fn)
            rel = "/" + os.path.relpath(full, DIST).replace(os.sep, "/")
            pages[rel] = parse(full)

if not pages:
    fail("build", "No HTML files found in %s" % DIST)
    print("FATAL: nothing to test"); sys.exit(1)

note("%d HTML pages built" % len(pages))


def resolves(url):
    """Does an internal URL map to a real file in dist?"""
    u = unquote(urlparse(url).path)
    if not u.startswith("/"):
        return None
    cands = [u, u.rstrip("/") + "/index.html", u + "index.html", u + ".html"]
    if u.endswith("/"):
        cands.append(u + "index.html")
    return any(os.path.isfile(os.path.join(DIST, c.lstrip("/"))) for c in cands)


# ---------- 1. internal links ----------
for page, p in sorted(pages.items()):
    for href in p.links:
        if href.startswith(("http://", "https://", "mailto:", "#", "tel:")):
            continue
        r = resolves(href)
        if r is False:
            fail("links", "%s -> dead internal link %s" % (page, href))

# ---------- 2. images ----------
for page, p in sorted(pages.items()):
    for img in p.imgs:
        src = img.get("src", "")
        if src.startswith(("http", "data:")):
            continue
        if src and resolves(src) is False:
            fail("images", "%s -> missing image %s" % (page, src))
        if "alt" not in img:
            fail("a11y", "%s -> <img> with no alt attribute (%s)" % (page, src))
        # An image only shifts layout if nothing reserves its space. The
        # .image-caption figure sets a CSS aspect-ratio on the container, so
        # those are already safe without width/height attributes.
        reserved = "image-caption" in img.get("_ancestors", "")
        if not img.get("width") or not img.get("height"):
            if not reserved:
                warn("perf", "%s -> <img %s> has no width/height and no container reserving space" % (page, src))

# ---------- 3. canonical / meta ----------
for page, p in sorted(pages.items()):
    can = p.links_rel.get("canonical", [None])[0]
    if not can:
        fail("seo", "%s -> no canonical URL" % page)
    elif "example.com" in can:
        fail("seo", "%s -> canonical still points at example.com" % page)
    elif not can.startswith(SITE):
        warn("seo", "%s -> canonical %s doesn't match site URL" % (page, can))
    for m in ("description", "og:title", "og:description", "og:url", "og:type"):
        if not p.metas.get(m):
            fail("seo", "%s -> missing <meta %s>" % (page, m))
    if not p.title or not p.title.strip():
        fail("seo", "%s -> empty <title>" % page)
    if not p.lang:
        fail("a11y", "%s -> <html> has no lang attribute" % page)
    if not p.links_rel.get("icon"):
        fail("seo", "%s -> no favicon link" % page)

# duplicate titles
seen = {}
for page, p in pages.items():
    t = (p.title or "").strip()
    seen.setdefault(t, []).append(page)
for t, ps in seen.items():
    if len(ps) > 1:
        warn("seo", "duplicate <title> %r on: %s" % (t, ", ".join(sorted(ps))))

# ---------- 4. headings ----------
for page, p in sorted(pages.items()):
    hs = [lvl for lvl, _ in p.headings]
    n1 = hs.count(1)
    if n1 == 0:
        fail("a11y", "%s -> no <h1>" % page)
    elif n1 > 1:
        warn("a11y", "%s -> %d <h1> elements" % (page, n1))
    prev = 0
    for lvl in hs:
        if prev and lvl > prev + 1:
            warn("a11y", "%s -> heading jumps h%d to h%d" % (page, prev, lvl))
        prev = lvl
    if len(hs) < 2 and page == "/index.html":
        warn("a11y", "%s -> only %d heading(s); list items aren't navigable by heading" % (page, len(hs)))

# ---------- 5. placeholder / draft leakage ----------
BAD = ["placeholder hotspot", "another dish here", "example.com", "Lorem ipsum", "The Blog"]
for root, _, files in os.walk(DIST):
    for fn in files:
        if not fn.endswith((".html", ".xml", ".txt")):
            continue
        full = os.path.join(root, fn)
        rel = "/" + os.path.relpath(full, DIST).replace(os.sep, "/")
        txt = open(full, encoding="utf-8", errors="ignore").read()
        for b in BAD:
            if b in txt:
                fail("content", "%s -> contains %r" % (rel, b))
        if "Night Owl" in txt or "night-owl" in txt:
            fail("drafts", "%s -> draft review leaked into build" % rel)

# ---------- 6. RSS ----------
rss_path = os.path.join(DIST, "rss.xml")
if not os.path.isfile(rss_path):
    fail("rss", "rss.xml not built")
else:
    raw = open(rss_path, encoding="utf-8").read()
    try:
        root = ET.fromstring(raw)
        note("rss.xml parses as valid XML")
        ch = root.find("channel")
        if ch is None:
            fail("rss", "no <channel>")
        else:
            for req in ("title", "link", "description"):
                if ch.find(req) is None or not (ch.find(req).text or "").strip():
                    fail("rss", "channel missing <%s>" % req)
            ns = "{http://www.w3.org/2005/Atom}link"
            selfl = [e for e in ch.findall(ns) if e.get("rel") == "self"]
            if not selfl:
                fail("rss", "missing <atom:link rel='self'> (validators flag this)")
            else:
                note("rss self-link: %s" % selfl[0].get("href"))
            if ch.find("lastBuildDate") is None:
                warn("rss", "no <lastBuildDate>")
            items = ch.findall("item")
            note("rss items: %d" % len(items))
            # An empty feed is only a bug if there was something to put in
            # it. A site whose reviews are all still drafts SHOULD publish a
            # feed with no items — that's valid RSS and the honest answer.
            # Comparing against the built review pages makes this catch the
            # case that actually matters: pages exist but the feed missed
            # them, which is a real regression in getPublishedReviews().
            review_pages = [p for p in pages if p.startswith("/reviews/")]
            if not items and review_pages:
                fail("rss", "%d review page(s) built but the feed has no items" % len(review_pages))
            elif not items:
                note("feed is empty because no review is published yet — expected")
            for it in items:
                t = it.find("title")
                l = it.find("link")
                g = it.find("guid")
                d = it.find("pubDate")
                nm = (t.text if t is not None else "?")
                if l is None or not (l.text or "").startswith("http"):
                    fail("rss", "item %r link is not absolute" % nm)
                if g is None:
                    fail("rss", "item %r has no <guid>" % nm)
                if d is None:
                    fail("rss", "item %r has no <pubDate>" % nm)
                else:
                    if not re.match(r"^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} (GMT|[+-]\d{4})$", d.text or ""):
                        fail("rss", "item %r pubDate not RFC-822: %r" % (nm, d.text))
                if l is not None and resolves(l.text) is False:
                    fail("rss", "item %r links to a page that doesn't exist" % nm)
    except ET.ParseError as e:
        fail("rss", "rss.xml is malformed XML: %s" % e)

# ---------- 7. sitemap ----------
sm_path = os.path.join(DIST, "sitemap.xml")
if not os.path.isfile(sm_path):
    fail("sitemap", "sitemap.xml not built")
else:
    try:
        root = ET.parse(sm_path).getroot()
        NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
        locs = [e.text for e in root.iter(NS + "loc")]
        note("sitemap entries: %d" % len(locs))
        for loc in locs:
            if "example.com" in loc:
                fail("sitemap", "%s still points at example.com" % loc)
            if resolves(loc) is False:
                fail("sitemap", "%s does not resolve to a built page" % loc)
        # every page in dist should be in the sitemap (except 404)
        for page in pages:
            path = page.replace("/index.html", "/").replace(".html", "")
            if page == "/404.html":
                continue
            if path == "/":
                path = "/"
            hit = any(urlparse(l).path.rstrip("/") == path.rstrip("/") for l in locs)
            if not hit:
                warn("sitemap", "%s is built but missing from sitemap.xml" % page)
    except ET.ParseError as e:
        fail("sitemap", "sitemap.xml malformed: %s" % e)

# ---------- 8. robots / 404 / favicon files ----------
for f, sev in [("robots.txt", fail), ("404.html", fail), ("favicon.svg", fail)]:
    if not os.path.isfile(os.path.join(DIST, f)):
        sev("files", "%s missing from build" % f)
if os.path.isfile(os.path.join(DIST, "robots.txt")):
    rb = open(os.path.join(DIST, "robots.txt")).read()
    if "Sitemap:" not in rb:
        warn("files", "robots.txt has no Sitemap: directive")
    elif "example.com" in rb:
        fail("files", "robots.txt Sitemap: still points at example.com")

# ---------- report ----------
W = 72
print("=" * W)
print("SITE TEST — %s" % DIST)
print("=" * W)
for n in notes:
    print("  info   %s" % n)
print("-" * W)
if not fails and not warns:
    print("  PASS   no issues found")
for c, m in fails:
    print("  FAIL   [%s] %s" % (c, m))
for c, m in warns:
    print("  WARN   [%s] %s" % (c, m))
print("-" * W)
print("%d failures, %d warnings" % (len(fails), len(warns)))
sys.exit(1 if fails else 0)
