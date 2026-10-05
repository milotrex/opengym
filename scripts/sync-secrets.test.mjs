/* What gets pushed to Cloudflare as a Worker secret, and what stops the push.
 *
 *   node --test scripts/
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayload } from './sync-secrets.mjs';

const SECRET = 'a'.repeat(64);

test('pushes the session secret on its own', () => {
  assert.deepEqual(buildPayload({ SESSION_SECRET: SECRET }), { SESSION_SECRET: SECRET });
});

test('pushes the VAPID pair and admin ids when they are set', () => {
  const env = { SESSION_SECRET: SECRET, VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', ADMIN_UIDS: 'u1,u2' };
  assert.deepEqual(buildPayload(env), env);
});

test('skips empty optional values instead of blanking them', () => {
  const out = buildPayload({ SESSION_SECRET: SECRET, ADMIN_UIDS: '  ', VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '' });
  assert.deepEqual(out, { SESSION_SECRET: SECRET });
});

test('refuses a missing or short session secret', () => {
  assert.throws(() => buildPayload({}), /SESSION_SECRET is not set/);
  assert.throws(() => buildPayload({ SESSION_SECRET: 'short' }), /shorter than 32/);
});

test('refuses half a VAPID pair', () => {
  assert.throws(() => buildPayload({ SESSION_SECRET: SECRET, VAPID_PUBLIC_KEY: 'pub' }), /both/);
  assert.throws(() => buildPayload({ SESSION_SECRET: SECRET, VAPID_PRIVATE_KEY: 'priv' }), /both/);
});
