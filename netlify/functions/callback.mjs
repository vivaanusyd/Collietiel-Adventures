// Step 2 of GitHub OAuth: trade the temporary code for an access token and
// hand it back to the CMS window that started the login.
//
// This is the half that holds the CLIENT SECRET, which is why it runs on a
// server. See auth.mjs for the full reasoning.

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

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

function errorPage(message) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Sign-in failed</title></head>` +
      `<body><h1>Sign-in failed</h1><p>${message}</p>` +
      `<p><a href="/admin/">Back to the editor</a></p></body></html>`,
    { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
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
