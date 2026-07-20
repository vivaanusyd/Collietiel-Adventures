// Starts sign-in for the editor at /desk/.
//
// WHY THIS EXISTS SEPARATELY FROM auth.mjs
//
// Both send someone to GitHub, but they end in different places. The CMS
// sign-in happens in a popup and hands a token back to the page that opened
// it (Sveltia's contract — see callback.mjs). The desk is a whole page behind
// a locked door: there is no opener to talk to, so it needs the ordinary
// redirect flow, ending with a session cookie and the visitor back at /desk/.
//
// WHY IT REUSES THE SAME CALLBACK URL
//
// A GitHub OAuth app registers ONE authorization callback URL, and GitHub
// refuses any redirect_uri that isn't it (or below it). Rather than making
// you register and configure a second OAuth app, both flows come back through
// /api/callback and it tells them apart by the cookie set below. That keeps
// this to zero new dashboard steps and zero new secrets.

const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';

export default async (request) => {
  const clientId = process.env.GITHUB_OAUTH_ID;
  if (!clientId) {
    return new Response(
      'GITHUB_OAUTH_ID is not set. Add it in Netlify → Site configuration → ' +
        'Environment variables, then redeploy. See docs/SETUP-CHECKLIST.md.',
      { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  }

  const url = new URL(request.url);
  const state = crypto.randomUUID();

  const authorize = new URL(GITHUB_AUTHORIZE);
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', new URL('/api/callback', url.origin).href);
  // Identity is all this flow needs. It asks GitHub one question — is this
  // person allowed to edit? — and then throws the token away, so there is no
  // reason to hold write access to anyone's repositories to answer it.
  authorize.searchParams.set('scope', 'read:user');
  authorize.searchParams.set('state', state);

  const cookie = (name, value) =>
    `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`;

  return new Response(null, {
    status: 302,
    headers: [
      ['Location', authorize.href],
      // Same CSRF defence as auth.mjs: a random value GitHub echoes back,
      // which we compare against a cookie a page script cannot read or forge.
      ['Set-Cookie', cookie('oauth_state', state)],
      // What tells callback.mjs which of the two flows this is.
      ['Set-Cookie', cookie('oauth_flow', 'desk')],
      ['Cache-Control', 'no-store, private'],
    ],
  });
};

export const config = { path: '/api/desk-auth' };
