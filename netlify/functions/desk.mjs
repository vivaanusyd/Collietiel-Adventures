// Serves the Sunday Table editor at /desk/, to signed-in editors only.
//
// WHY THE PAGE IS NOT A STATIC FILE ANY MORE
//
// It used to live in public/, which means the CDN hands it to anyone who
// asks. Nothing checked in the page itself could have changed that: a static
// host serves the bytes before any of the page's own JavaScript exists, so a
// "login screen" written inside the file is a picture of a lock — view-source
// walks straight past it, and so does `curl`.
//
// So the file moved out of public/ entirely and is served from here instead,
// where the check happens BEFORE the bytes are sent. A visitor without a
// valid session gets a redirect and no page at all.
//
// Worth being straight about what this does and does not do: the editor's
// source is in a public repository and always was, so this is not hiding the
// code. What it protects is the running editor on this site — and, once
// Publish is wired to real commits, the machinery behind it.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SESSION_COOKIE, readCookies, verifySession } from '../lib/session.mjs';

// Read once per cold start rather than per request — it's ~1.9 MB.
let cachedPage = null;

// Both homes the page can have: public/ while the gate is off (served
// statically, which is why it's in public/ at all), functions-assets/ while
// the gate is on (out of the CDN's reach, so this function is the only way
// to get it). Trying both means switching the gate on or off can't leave
// this pointing at a file that has moved.
const PAGE_LOCATIONS = ['public/desk/index.html', 'functions-assets/desk.html'];

async function loadPage() {
  if (cachedPage) return cachedPage;
  const failures = [];
  for (const location of PAGE_LOCATIONS) {
    try {
      cachedPage = await readFile(join(process.cwd(), location), 'utf8');
      return cachedPage;
    } catch (error) {
      failures.push(`${location} (${error.code || error.message})`);
    }
  }
  throw new Error(`editor page not found in the bundle — tried ${failures.join(', ')}`);
}

export default async (request) => {
  const secret = process.env.DESK_SESSION_SECRET;
  if (!secret) {
    // Fail closed and say why. The alternative — serving the page when the
    // secret is missing — would turn a misconfiguration into an open door.
    return new Response(
      'DESK_SESSION_SECRET is not set on this site, so the editor cannot be ' +
        'unlocked. Add it in Netlify → Site configuration → Environment ' +
        'variables, then redeploy. See docs/SETUP-CHECKLIST.md.',
      { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  }

  const cookies = readCookies(request);
  const login = await verifySession(cookies[SESSION_COOKIE], secret);

  if (!login) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/api/desk-auth',
        'Cache-Control': 'no-store, private',
      },
    });
  }

  try {
    return new Response(await loadPage(), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Never let a CDN or proxy keep a copy of a page that is only meant
        // for signed-in editors — a shared cache would hand it to the next
        // person who asked, gate or no gate.
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch (error) {
    return new Response(
      'The editor page could not be read on the server. This is a deploy ' +
        `problem, not a sign-in one: ${error.message}`,
      { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  }
};

// ─────────────────────────────────────────────────────────────────────────
// THE GATE IS CURRENTLY OFF. This function does not claim /desk/, so the
// page is served straight from public/ like any other file, and anyone with
// the link can open the editor.
//
// That was a deliberate choice, not an accident: the gate needs a signing
// key set in Netlify, and Vivaan didn't want to deal with sign-in yet. The
// code is kept rather than deleted so turning it on is three small edits
// instead of a rebuild.
//
// TO SWITCH IT BACK ON:
//
//   1. Set DESK_SESSION_SECRET in Netlify → Site configuration →
//      Environment variables (`openssl rand -base64 32` makes one).
//   2. Uncomment the export below, so this function answers /desk/.
//   3. Move public/desk/index.html to functions-assets/desk.html and add
//      this to netlify.toml, so the CDN can't serve the page around the
//      check and the function still has it:
//
//          [functions."desk"]
//            included_files = ["functions-assets/desk.html"]
//
//      Step 3 is the one that actually matters. Without it the file stays
//      in public/ and the CDN keeps handing it out, gate or no gate — a
//      lock on a door that still has its wall missing.
//
// Nothing else needs changing: /api/desk-auth and the desk branch in
// callback.mjs stay wired up, and test/session.test.mjs still covers the
// cookie signing.
//
// export const config = { path: ['/desk', '/desk/'] };
// ─────────────────────────────────────────────────────────────────────────
