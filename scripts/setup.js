// Validate community storage and admin configuration without writing records.
import { loadEnvironment } from './load-env.js';
import { db } from '../api/_lib/db.js';
loadEnvironment();
let failed = false;
function fail(message) { failed = true; console.error('FAIL:', message); }
const required = ['SUPABASE_URL', 'ADMIN_PASSWORD', 'SESSION_SECRET'];
for (const name of required) if (!process.env[name]) fail(`${name} is not set`);
if (!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) fail('SUPABASE_SECRET_KEY is not set');
if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length < 14) fail('Use an admin password of at least 14 characters');
if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) fail('Use a session secret of at least 32 characters');
if (failed) process.exit(1);
for (const table of ['applications', 'waitlist']) {
  try {
    const total = await db.count(table);
    console.log(`OK: ${table} is reachable (${total} records)`);
  } catch { fail(`${table} could not be read. Check credentials and run npm run migrate:community.`); }
}
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
if (publicKey) {
  const headers = { apikey:publicKey };
  if (!publicKey.startsWith('sb_publishable_')) headers.Authorization = `Bearer ${publicKey}`;
  for (const table of ['applications', 'waitlist']) {
    try {
      const response = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}?select=id&limit=1`, { headers, signal:AbortSignal.timeout(10000) });
      const rows = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) console.log(`OK: public reads of ${table} are denied`);
      else if (response.ok && Array.isArray(rows) && rows.length === 0) console.log(`OK: the public key returned no ${table} records`);
      else fail(`Unexpected public access result for ${table}; verify table grants and row security`);
    } catch { fail(`Could not check public access to ${table}`); }
  }
}
process.exitCode = failed ? 1 : 0;
if (!failed) console.log('Community backend checks passed. Admin inbox: /admin');
