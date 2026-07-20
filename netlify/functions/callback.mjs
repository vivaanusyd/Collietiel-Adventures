// Step 2 of GitHub OAuth: trade the temporary code for an access token and
// hand it back to the CMS window that started the login.
//
// This is the half that holds the CLIENT SECRET, which is why it runs on a
// server. See auth.mjs for the full reasoning.

import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from '../lib/session.mjs';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

// Which repository's collaborator list decides who may edit. Public
// information — it's the repo this file is in — so it isn't a secret, but it
// lives in one named constant rather than being spelled out twice below.
const EDITOR_REPO = process.env.DESK_REPO || 'vivaanusyd/Collietiel-Adventures';

/**
 * Finish the /desk/ sign-in: decide whether this GitHub account may edit,
 * and if so issue our own session cookie.
 *
 * The authorisation question is answered HERE, on the server, by asking
 * GitHub — not in the browser. `permissions.push` is GitHub's own answer to
 * "can this account write to this repository", which is the same list that
 * decides who can merge a review. Add or remove someone in the repo's
 * Settings → Collaborators and this follows immediately, with no second list
 * to maintain and no way to talk the browser out of the answer.
 *
 * The GitHub token is used only for these two calls and never stored.
 */
async function finishDeskSignIn(token, url) {
  const secret = process.env.DESK_SESSION_SECRET;
  if (!secret) {
    return errorPage(
      'DESK_SESSION_SECRET is not set on this site, so a sign-in cannot be ' +
        'issued. See docs/SETUP-CHECKLIST.md.'
    );
  }

  const gh = (path) =>
    fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'collietiel-adventures-desk',
      },
    });

  const [userResponse, repoResponse] = await Promise.all([
    gh('/user'),
    gh(`/repos/${EDITOR_REPO}`),
  ]);

  const user = await userResponse.json().catch(() => ({}));
  const repo = await repoResponse.json().catch(() => ({}));

  if (!userResponse.ok || !user.login) {
    return errorPage('GitHub would not say who you are, so sign-in stopped here.');
  }

  // No permissions block means the question was never actually answered —
  // treat that as "no". A gate that opens when it cannot tell is not a gate.
  if (!repo || typeof repo.permissions !== 'object' || repo.permissions === null) {
    return errorPage(
      `GitHub did not report your access level for ${EDITOR_REPO}, so you were not let in. ` +
        'If this happens to an account that IS a collaborator, the sign-in scope in ' +
        'desk-auth.mjs needs widening from read:user to public_repo.'
    );
  }

  if (repo.permissions.push !== true) {
    return errorPage(
      `The account <strong>${user.login}</strong> does not have write access to ` +
        `${EDITOR_REPO}, so it cannot open the editor. Ask the site owner to add you under ` +
        'Settings → Collaborators.',
      403
    );
  }

  const session = await signSession(user.login, secret, SESSION_TTL_SECONDS);
  const clear = (name) => `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

  return new Response(null, {
    status: 302,
    headers: [
      ['Location', new URL('/desk/', url.origin).href],
      [
        'Set-Cookie',
        `${SESSION_COOKIE}=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; ` +
          `Max-Age=${SESSION_TTL_SECONDS}`,
      ],
      ['Set-Cookie', clear('oauth_state')],
      ['Set-Cookie', clear('oauth_flow')],
      ['Cache-Control', 'no-store, private'],
    ],
  });
}

/**
 * The page that closes the loop.
 *
 * Sveltia/Decap's contract: the popup posts `authorizing:github` to whoever
 * opened it, the opener replies, and the popup then posts the result back to
 * that specific origin. The reply is what tells us the opener is really the
 * CMS and gives us its origin — so the token is never broadcast to `*`,
 * which would hand it to any page that happened to be listening.
 */
function respondToOpener(payload) {
  // JSON.stringify twice: once for the message body the CMS parses, once to
  // embed it safely as a JS string literal. `<` is escaped so a value can
  // never close this script tag.
  const message = JSON.stringify(payload).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Signing in…</title></head>
  <body>
    <p>Finishing sign-in. You can close this window if it stays open.</p>
    <script>
      (function () {
        var payload = ${JSON.stringify(message)};
        function receive(event) {
          if (!window.opener) return;
          window.removeEventListener('message', receive, false);
          window.opener.postMessage('authorization:github:success:' + payload, event.origin);
          window.close();
        }
        window.addEventListener('message', receive, false);
        if (window.opener) {
          window.opener.postMessage('authorizing:github', '*');
        } else {
          document.body.textContent =
            'This window was opened directly rather than by the editor. Go to /admin/ and sign in from there.';
        }
      })();
    </script>
  </body>
</html>`;
}

function errorPage(message, status = 400) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Sign-in failed</title></head>` +
      `<body><h1>Sign-in failed</h1><p>${message}</p>` +
      `<p><a href="/admin/">Back to the editor</a></p></body></html>`,
    {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, private' },
    }
  );
}

export default async (request) => {
  const clientId = process.env.GITHUB_OAUTH_ID;
  const clientSecret = process.env.GITHUB_OAUTH_SECRET;

  if (!clientId || !clientSecret) {
    return errorPage(
      'GITHUB_OAUTH_ID / GITHUB_OAUTH_SECRET are not set on this site. ' +
        'See docs/SETUP-CHECKLIST.md.'
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    const denied = url.searchParams.get('error_description') || 'No code was returned by GitHub.';
    return errorPage(denied);
  }

  // Check the CSRF token we set in auth.mjs. A mismatch means this callback
  // wasn't started by the login we issued, so the code is not ours to spend.
  const cookies = Object.fromEntries(
    (request.headers.get('cookie') || '')
      .split(';')
      .map((c) => c.trim().split('='))
      .filter(([k]) => k)
  );

  if (!state || state !== cookies.oauth_state) {
    return errorPage(
      'The sign-in could not be verified (state mismatch). Start again from ' +
        '<a href="/admin/">the editor</a>.'
    );
  }

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: new URL('/api/callback', url.origin).href,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error || !data.access_token) {
    return errorPage(
      `GitHub refused the sign-in: ${data.error_description || data.error || response.status}`
    );
  }

  // Two flows come through here. The desk sets a cookie in desk-auth.mjs to
  // say so; anything without it is the CMS popup, which is the original
  // behaviour and stays exactly as it was.
  if (cookies.oauth_flow === 'desk') {
    return finishDeskSignIn(data.access_token, url);
  }

  return new Response(respondToOpener({ token: data.access_token, provider: 'github' }), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Clear the CSRF cookie — it's single-use.
      'Set-Cookie': 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
      // The token is in this response body. It must never be cached by a
      // proxy, a CDN, or the browser's back button.
      'Cache-Control': 'no-store, private',
    },
  });
};

export const config = { path: '/api/callback' };
