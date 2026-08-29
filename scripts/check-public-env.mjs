import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// This repository intentionally tracks public defaults for Lovable and Vercel.
// Validate values without printing keys or making network requests.
const allowed = new Set([
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PROJECT_ID',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
]);
const values = {};
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  if (!line.trim() || line.trimStart().startsWith('#')) continue;
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  assert(match && allowed.has(match[1]), 'Unexpected field in public .env');
  assert(!(match[1] in values), 'Duplicate field in public .env');
  values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
}
assert.equal(Object.keys(values).length, allowed.size, 'Missing public configuration');
assert.match(values.VITE_SUPABASE_PROJECT_ID, /^[a-z0-9]+$/);
assert.equal(values.VITE_SUPABASE_URL, `https://${values.VITE_SUPABASE_PROJECT_ID}.supabase.co`);
const key = values.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
  const parts = key.split('.');
  assert.equal(parts.length, 3, 'Expected a publishable key or legacy anon JWT');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  assert.equal(payload.role, 'anon', 'Only a public anon key may be committed');
  assert.equal(payload.ref, values.VITE_SUPABASE_PROJECT_ID, 'Key project mismatch');
}
console.log('Public Supabase configuration is consistent; no privileged key in .env.');
