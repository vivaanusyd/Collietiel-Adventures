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

// Both homes the page can have: functions-assets/ while the gate is on
// (out of the CDN's reach, so this function is the only way to get it) —
// which is where it lives now — and public/ while the gate is off, served
// statically. Trying both means switching the gate on or off can't leave
// this pointing at a file that has moved.
const PAGE_LOCATIONS = ['functions-assets/desk.html', 'public/desk/index.html'];

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
// THE GATE IS ON. This function claims /desk/, the page lives in
// functions-assets/ where the CDN can't reach it, and DESK_SESSION_SECRET
// is set in Netlify. All three are load-bearing: drop any one and the lock
// stops locking, in two cases silently.
//
// The one to guard hardest is the page's location. If it ever moves back
// into public/, the CDN serves it around this check and the site keeps
// looking exactly as correct as it does now — a lock on a door with no
// wall. netlify.toml's `included_files` is what carries the file into the
// bundle from outside public/; without it this function 500s, which at
// least fails loudly.
//
// TO SWITCH IT OFF: move functions-assets/desk.html back to
// public/desk/index.html, comment the export below out again, and drop the
// included_files block. Deleting DESK_SESSION_SECRET is NOT how you turn it
// off — with the export live, a missing secret is a 500, on purpose.
//
// /api/desk-auth and the desk branch in callback.mjs do the sign-in;
// test/session.test.mjs covers the cookie signing.
export const config = { path: ['/desk', '/desk/'] };
// ─────────────────────────────────────────────────────────────────────────
