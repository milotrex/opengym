#!/usr/bin/env node
/* Pushes the Worker's secrets from environment variables to Cloudflare with `wrangler secret bulk`.
 * Run by .github/workflows/sync-secrets.yml, which fills the environment from GitHub repository
 * secrets. Nothing here ever prints a value: only the names it pushed.
 *
 *   SESSION_SECRET=... node scripts/sync-secrets.mjs
 *
 * Empty or unset optional values are skipped, not sent, so they never blank a secret that is
 * already set on the Worker.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const REQUIRED = ['SESSION_SECRET'];
export const OPTIONAL = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'ADMIN_UIDS'];
const MIN_SESSION_SECRET = 32;

export function buildPayload(env) {
  const out = {};
  for (const name of [...REQUIRED, ...OPTIONAL]) {
    const v = String(env[name] ?? '').trim();
    if (v) out[name] = v;
  }
  for (const name of REQUIRED) {
    if (!out[name]) throw new Error(`${name} is not set. Add it as a GitHub repository secret.`);
  }
  if (out.SESSION_SECRET.length < MIN_SESSION_SECRET) {
    throw new Error(`SESSION_SECRET is shorter than ${MIN_SESSION_SECRET} characters. Use \`openssl rand -hex 32\`.`);
  }
  // Half a pair is worse than none: push would fail at runtime instead of being switched off.
  if (Boolean(out.VAPID_PUBLIC_KEY) !== Boolean(out.VAPID_PRIVATE_KEY)) {
    throw new Error('Set both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY, or neither.');
  }
  return out;
}

function main() {
  const payload = buildPayload(process.env);
  const dir = mkdtempSync(path.join(tmpdir(), 'opengym-secrets-'));
  const file = path.join(dir, 'secrets.json');
  try {
    writeFileSync(file, JSON.stringify(payload), { mode: 0o600 });
    console.log(`Pushing ${Object.keys(payload).length} secret(s): ${Object.keys(payload).join(', ')}`);
    const r = spawnSync('npx', ['wrangler', 'secret', 'bulk', file], { stdio: 'inherit' });
    if (r.status !== 0) process.exitCode = r.status ?? 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (e) { console.error(e.message); process.exit(1); }
}
