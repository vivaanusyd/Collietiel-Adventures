import { describe, expect, it } from 'vitest';
import {
  SESSION_COOKIE,
  readCookies,
  signSession,
  verifySession,
} from '../netlify/lib/session.mjs';

// These tests are the whole reason the gate in front of /desk/ can be
// trusted. The failure mode being guarded against is not a crash — it's a
// forged cookie that verifies successfully and silently lets a stranger in,
// which nothing else in the build would notice.

const SECRET = 'test-secret-not-the-real-one';

describe('signSession / verifySession', () => {
  it('accepts a session it issued', async () => {
    const cookie = await signSession('vivaanusyd', SECRET, 3600);
    expect(await verifySession(cookie, SECRET)).toBe('vivaanusyd');
  });

  it('rejects a session signed with a different secret', async () => {
    const cookie = await signSession('vivaanusyd', SECRET, 3600);
    expect(await verifySession(cookie, 'some-other-secret')).toBeNull();
  });

  it('rejects a tampered username', async () => {
    // The attack this exists for: take a valid cookie, swap the name for
    // someone with access, keep the signature and hope it isn't checked.
    const cookie = await signSession('outsider', SECRET, 3600);
    const [, signature] = cookie.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ u: 'vivaanusyd', exp: Math.floor(Date.now() / 1000) + 3600 })
    )
      .toString('base64url')
      .replace(/=+$/, '');

    expect(await verifySession(`${forgedPayload}.${signature}`, SECRET)).toBeNull();
  });

  it('rejects an expired session', async () => {
    const cookie = await signSession('vivaanusyd', SECRET, -1);
    expect(await verifySession(cookie, SECRET)).toBeNull();
  });

  it('rejects malformed, empty and missing values', async () => {
    for (const value of ['', 'nonsense', 'a.b.c', 'only-one-part', undefined, null]) {
      expect(await verifySession(value, SECRET)).toBeNull();
    }
  });

  it('rejects everything when the secret is missing', async () => {
    const cookie = await signSession('vivaanusyd', SECRET, 3600);
    expect(await verifySession(cookie, undefined)).toBeNull();
    expect(await verifySession(cookie, '')).toBeNull();
  });

  it('survives a round trip through a real cookie header', async () => {
    const cookie = await signSession('vivaanusyd', SECRET, 3600);
    const request = {
      headers: {
        get: () => `oauth_state=abc; ${SESSION_COOKIE}=${cookie}; other=1`,
      },
    };
    const cookies = readCookies(request);
    // base64url can't contain ';' or '=' padding, but it CAN contain '-' and
    // '_' — the point of the check is that the value arrives intact.
    expect(cookies[SESSION_COOKIE]).toBe(cookie);
    expect(await verifySession(cookies[SESSION_COOKIE], SECRET)).toBe('vivaanusyd');
  });
});

describe('readCookies', () => {
  it('returns an empty object when there are no cookies', () => {
    expect(readCookies({ headers: { get: () => null } })).toEqual({});
  });

  it('keeps values containing = intact', () => {
    const cookies = readCookies({ headers: { get: () => 'a=one=two; b=three' } });
    expect(cookies.a).toBe('one=two');
    expect(cookies.b).toBe('three');
  });
});
