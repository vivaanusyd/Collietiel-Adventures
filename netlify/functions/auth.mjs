// Step 1 of GitHub OAuth: send the writer to GitHub to approve access.
//
// WHY THIS IS A SERVER FUNCTION AND NOT PAGE JAVASCRIPT
//
// Completing OAuth requires exchanging a temporary code for an access token,
// and that exchange must be signed with the app's CLIENT SECRET. A static
// site has nowhere to keep a secret — anything the page can read, so can
// anyone who opens devtools. So the secret lives in a Netlify environment
// variable and never leaves the server; see callback.mjs, which uses it.
//
// This half holds no secret (the client ID is public by design), but it
// lives here so both halves of the handshake are in one place.

const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';

export default async (request) => {
  const clientId = process.env.GITHUB_OAUTH_ID;
  if (!clientId) {
    // A blank page with a broken login is the worst version of this. Say
    // exactly which variable is missing and where it goes.
    return new Response(
      'GITHUB_OAUTH_ID is not set. Add it in Netlify → Site configuration → ' +
        'Environment variables, then redeploy. See docs/SETUP-CHECKLIST.md.',
      { status: 500, headers: { 'Content-Type': 'text/plain' } }
    );
  }

  const url = new URL(request.url);

  // `state` is the CSRF defence: a random value we hand to GitHub and check
  // again on the way back. Without it, an attacker can complete someone
  // else's login flow by feeding them a crafted callback URL. It's stored in
  // a short-lived, HTTP-only cookie so page scripts can't read or forge it.
  const state = crypto.randomUUID();

  const authorize = new URL(GITHUB_AUTHORIZE);
  authorize.searchParams.set('client_id', clientId);
  // `repo` is the narrowest scope that works here: the CMS commits to a
  // repository and, under editorial workflow, opens and updates pull
  // requests. `public_repo` would be narrower still and is worth switching
  // to if this repository is public and stays that way.
  authorize.searchParams.set('scope', url.searchParams.get('scope') || 'repo');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('redirect_uri', new URL('/api/callback', url.origin).href);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.href,
      'Set-Cookie': [
        `oauth_state=${state}`,
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
        'Path=/',
        'Max-Age=600',
      ].join('; '),
      'Cache-Control': 'no-store',
    },
  });
};

export const config = { path: '/api/auth' };
