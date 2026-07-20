// Signed session cookies for the gate in front of /desk/.
//
// WHY A SIGNED COOKIE AND NOT THE GITHUB TOKEN
//
// The obvious shortcut is to keep GitHub's access token in a cookie and
// re-ask GitHub on every request. That stores a credential that can write to
// the writer's repositories in a place we don't need it, and it makes every
// page load depend on GitHub being up. Instead the token is used once, at
// sign-in, to answer a single question — may this person edit? — and then
// discarded. What's kept is our own statement of the answer, signed so the
// browser can't rewrite it.
//
// The signature is what makes that safe. A cookie the browser could edit
// would let anyone set `user=vivaan` and walk in; an HMAC the server checks
// means the only cookies we accept are ones we issued.

const encoder = new TextEncoder();

/** base64url — the plain base64 alphabet is not safe in a cookie value. */
function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmac(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

/**
 * Compare two signatures without leaking, through timing, how much of the
 * signature was correct. A plain `===` returns faster the earlier it finds a
 * difference, which is enough to reconstruct a valid signature byte by byte.
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Issue a session for `login`, valid for `ttlSeconds`. */
export async function signSession(login, secret, ttlSeconds) {
  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ u: login, exp: Math.floor(Date.now() / 1000) + ttlSeconds }))
  );
  return `${payload}.${toBase64Url(await hmac(payload, secret))}`;
}

/**
 * Returns the GitHub login the cookie vouches for, or null.
 *
 * Null covers every failure — malformed, forged, expired — deliberately: the
 * caller has exactly one safe response to all of them, which is to send the
 * visitor to sign in. Distinguishing them in the response would tell someone
 * probing the endpoint which part of their guess was wrong.
 */
export async function verifySession(cookieValue, secret) {
  try {
    if (!cookieValue || !secret) return null;
    const [payload, signature] = cookieValue.split('.');
    if (!payload || !signature) return null;

    const expected = await hmac(payload, secret);
    if (!timingSafeEqual(fromBase64Url(signature), expected)) return null;

    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (!claims.u || typeof claims.exp !== 'number') return null;
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;

    return claims.u;
  } catch {
    return null;
  }
}

/** Cookies as a plain object. Values are not decoded — ours are base64url. */
export function readCookies(request) {
  return Object.fromEntries(
    (request.headers.get('cookie') || '')
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const eq = c.indexOf('=');
        return eq === -1 ? [c, ''] : [c.slice(0, eq), c.slice(eq + 1)];
      })
  );
}

export const SESSION_COOKIE = 'desk_session';

/** Twelve hours: a working day, then sign in again. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
