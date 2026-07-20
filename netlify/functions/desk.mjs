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

async function loadPage() {
  if (cachedPage) return cachedPage;
  // Included in the bundle via `included_files` in netlify.toml, which places
  // it relative to the working directory the function runs in.
  cachedPage = await readFile(join(process.cwd(), 'functions-assets/desk.html'), 'utf8');
  return cachedPage;
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

// Both spellings, so /desk doesn't 404 on the way to /desk/.
export const config = { path: ['/desk', '/desk/'] };
