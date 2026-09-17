import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completeAuthCallback, MOBILE_AUTH_REDIRECT, INVALID_LINK_MESSAGE } from '../lib/auth-callback.ts';

const session = { user: { id: 'test-owner' } };
const success = { data: { session }, error: null };
function client(overrides = {}) {
  return {
    exchangeCodeForSession: async () => success,
    setSession: async () => success,
    ...overrides,
  };
}

test('installed prototype has a stable callback independent of network address', () => {
  assert.equal(MOBILE_AUTH_REDIRECT, 'bizcard://auth/callback');
});

test('exchanges PKCE code and returns authenticated session', async () => {
  let received;
  const actual = await completeAuthCallback(`${MOBILE_AUTH_REDIRECT}?code=one-time-code`, client({
    exchangeCodeForSession: async code => { received = code; return success; },
  }));
  assert.equal(received, 'one-time-code');
  assert.equal(actual, session);
});

test('handles token fragments even when callback has a query string', async () => {
  let received;
  await completeAuthCallback(`${MOBILE_AUTH_REDIRECT}?source=email#access_token=access&refresh_token=refresh`, client({
    setSession: async tokens => { received = tokens; return success; },
  }));
  assert.deepEqual(received, { access_token: 'access', refresh_token: 'refresh' });
});

test('returned exchange errors and missing sessions are failures, not endless loading', async () => {
  for (const result of [{ data: { session: null }, error: { message: 'private backend details' } }, { data: { session: null }, error: null }]) {
    await assert.rejects(completeAuthCallback(`${MOBILE_AUTH_REDIRECT}?code=expired`, client({ exchangeCodeForSession: async () => result })), { message: INVALID_LINK_MESSAGE });
  }
});

test('expired callbacks and missing credentials never call the auth service', async () => {
  const auth = client({ exchangeCodeForSession: async () => assert.fail('must not exchange'), setSession: async () => assert.fail('must not set session') });
  for (const suffix of ['', '?error=access_denied&error_description=secret', '#error_code=otp_expired', '#access_token=incomplete']) {
    await assert.rejects(completeAuthCallback(MOBILE_AUTH_REDIRECT + suffix, auth), { message: INVALID_LINK_MESSAGE });
  }
});

test('ignores unrelated deep links and malformed URLs', async () => {
  const auth = client({ exchangeCodeForSession: async () => assert.fail('must not exchange') });
  for (const url of ['not a URL', 'https://example.com/auth/callback?code=abc', 'bizcard://my-card?code=abc', 'bizcard://auth/callback-other?code=abc']) assert.equal(await completeAuthCallback(url, auth), null);
});

test('network exceptions propagate for the provider to show retry UI', async () => {
  await assert.rejects(completeAuthCallback(`${MOBILE_AUTH_REDIRECT}?code=abc`, client({ exchangeCodeForSession: async () => { throw new Error('offline'); } })), /offline/);
});
