// Checks that the backend is wired up correctly, and tells you exactly what to
// fix if it isn't.
//
//   npm run setup

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const ROOT = join(import.meta.dirname, '..');
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const info = (m) => console.log(`    \x1b[2m${m}\x1b[0m`);

console.log('\n  World Labs — backend check\n');

// ── 1. .env.local ────────────────────────────────────────────────────
const envPath = join(ROOT, '.env.local');
if (!existsSync(envPath)) {
  bad('.env.local is missing.');
  info('Create it with:');
  info('');
  info('  SUPABASE_URL=https://xxxx.supabase.co');
  info('  SUPABASE_SERVICE_ROLE_KEY=eyJhb...');
  info('  ADMIN_PASSWORD=<pick one>');
  info(`  SESSION_SECRET=${randomBytes(32).toString('hex')}`);
  info('');
  info('Supabase → Project Settings → API. Use the service_role key.');
  process.exit(1);
}

for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  process.env[t.slice(0, i).trim()] ??= t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
ok('.env.local found');

// ── 2. Required vars ─────────────────────────────────────────────────
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_PASSWORD', 'SESSION_SECRET'];
const missing = REQUIRED.filter((k) => !process.env[k]);

if (missing.length) {
  bad(`Missing: ${missing.join(', ')}`);
  if (missing.includes('SESSION_SECRET')) {
    info(`Generate one: SESSION_SECRET=${randomBytes(32).toString('hex')}`);
  }
  process.exit(1);
}
ok('all four environment variables are set');

if (process.env.SESSION_SECRET.length < 32) {
  bad('SESSION_SECRET is short. It signs your admin session — make it 32+ chars.');
  info(`Try: ${randomBytes(32).toString('hex')}`);
}
if (process.env.ADMIN_PASSWORD.length < 12) {
  bad('ADMIN_PASSWORD is short. It is the only thing between the public and your applicant data.');
}

// The anon key is safe to expose; the service_role key is not. They look
// similar, so check we were handed the right one.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY.includes('.')) {
  bad('SUPABASE_SERVICE_ROLE_KEY does not look like a JWT. Did you paste the right key?');
}

// ── 3. Can we reach Supabase? ────────────────────────────────────────
const base = process.env.SUPABASE_URL.replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function probe(table) {
  const res = await fetch(`${base}/rest/v1/${table}?select=*&limit=1`, { headers });
  return { status: res.status, body: await res.text() };
}

let reachable = false;
try {
  const res = await fetch(`${base}/rest/v1/`, { headers });
  reachable = res.status < 500;
  if (reachable) ok(`Supabase reachable at ${base}`);
  else bad(`Supabase returned ${res.status}`);
} catch (err) {
  bad(`Cannot reach Supabase: ${err.message}`);
  info('Check SUPABASE_URL.');
  process.exit(1);
}

// ── 4. Has the schema been applied? ──────────────────────────────────
const TABLES = ['applications', 'waitlist', 'eval_categories', 'models', 'environments', 'runs', 'scores', 'leaderboard'];
const absent = [];

for (const t of TABLES) {
  const { status } = await probe(t);
  if (status === 200) ok(`table  ${t}`);
  else if (status === 401 || status === 403) {
    bad(`${t}: key rejected (${status}). That is the anon key, not service_role.`);
    process.exit(1);
  } else {
    absent.push(t);
    bad(`table  ${t} — not found`);
  }
}

if (absent.length) {
  console.log('');
  bad('The schema has not been applied yet.');
  info('Supabase → SQL Editor → New query → paste the contents of sql/001_init.sql → Run.');
  info(`(${absent.length} of ${TABLES.length} tables missing)`);
  console.log('');
  process.exit(1);
}

// ── 5. Categories seeded? ────────────────────────────────────────────
const cats = await fetch(`${base}/rest/v1/eval_categories?select=slug`, { headers }).then((r) => r.json());
if (Array.isArray(cats) && cats.length === 14) ok('all 14 eval categories seeded');
else bad(`expected 14 eval categories, found ${Array.isArray(cats) ? cats.length : '?'} — re-run sql/001_init.sql`);

// ── 6. RLS actually locked down? ─────────────────────────────────────
// The whole security model rests on the anon key being able to read nothing.
// If someone adds a permissive policy later, this is what catches it.
const anon = process.env.SUPABASE_ANON_KEY;
if (anon) {
  const res = await fetch(`${base}/rest/v1/applications?select=*&limit=1`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  const body = await res.json().catch(() => null);
  if (Array.isArray(body)) {
    bad('DANGER: the public anon key can read the applications table.');
    info('RLS is not locked down. Re-run the RLS section at the bottom of sql/001_init.sql.');
  } else {
    ok('RLS holds — the public key cannot read applications');
  }
} else {
  info('(set SUPABASE_ANON_KEY in .env.local to also verify RLS is locked down)');
}

console.log('\n  Ready. Run `npm run dev` and open http://localhost:3000/apply\n');
