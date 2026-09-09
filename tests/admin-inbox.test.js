import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFakeSupabase } from './fake-supabase.js';
import { mockReq, mockRes } from './helpers.js';
import { issueToken } from '../api/_lib/auth.js';
import { __resetRateLimit } from '../api/_lib/http.js';
import applications from '../api/admin/applications.js';
import waitlist from '../api/admin/waitlist.js';
import signup from '../api/waitlist.js';
import { db } from '../api/_lib/db.js';

const fake = createFakeSupabase();
before(async () => {
  process.env.SUPABASE_URL = await fake.listen();
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_local_test';
  process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef';
});
after(() => fake.close());
beforeEach(() => { fake.reset(); __resetRateLimit(); });
async function get(handler, query = '', cookie = `wl_admin=${issueToken()}`) {
  const res = mockRes();
  await handler(mockReq({ url:`/api/admin/submissions?${query}`, cookie }), res);
  return res;
}
function application(overrides = {}) {
  return { id:randomUUID(), created_at:'2026-09-08T10:00:00Z', full_name:'Test Applicant', email:`${randomUUID()}@example.com`, shipped_credits:'Example Game, systems designer', status:'pending', ...overrides };
}

test('waitlist is private, including malformed and forged cookies', async () => {
  fake.tables.waitlist.push({ id:randomUUID(), email:'private@example.com' });
  for (const cookie of ['', 'wl_admin=%not-encoded', 'wl_admin=123.forged.signature']) {
    const response = await get(waitlist, '', cookie);
    assert.equal(response.statusCode, 401);
    assert.equal(response.json.signups, undefined);
    assert.equal(response.getHeader('cache-control'), 'no-store');
  }
});

test('applications paginate with stable ordering and counts independent of page size', async () => {
  for (let i = 0; i < 1205; i++) fake.tables.applications.push(application({ status:i < 1200 ? 'pending' : 'approved' }));
  const first = await get(applications, 'status=pending&limit=25&page=1');
  const second = await get(applications, 'status=pending&limit=25&page=2');
  assert.equal(first.json.counts.pending, 1200);
  assert.equal(first.json.total, 1205);
  assert.equal(first.json.pagination.total, 1200);
  assert.equal(first.json.pagination.hasMore, true);
  assert.equal(first.json.applications.length, 25);
  const ids = new Set(first.json.applications.map(row => row.id));
  assert.ok(second.json.applications.every(row => !ids.has(row.id)));
});

test('search supports punctuation without injecting extra filters', async () => {
  const name = 'A&B, "Game" (Systems)';
  fake.tables.applications.push(application({ full_name:name }), application({ full_name:'Unrelated', status:'approved' }));
  const query = new URLSearchParams({ q:name, status:'pending' });
  const response = await get(applications, query.toString());
  assert.equal(response.statusCode, 200);
  assert.equal(response.json.applications.length, 1);
  assert.equal(response.json.applications[0].full_name, name);
  const injection = await get(applications, new URLSearchParams({ q:'&status=eq.approved', status:'pending' }).toString());
  assert.equal(injection.json.applications.length, 0);
});

test('literal percentage and underscore searches do not become wildcards', async () => {
  fake.tables.applications.push(application({ full_name:'100%_Games' }), application({ full_name:'100xxGames' }));
  const response = await get(applications, new URLSearchParams({ q:'%_', status:'all' }).toString());
  assert.equal(response.json.applications.length, 1);
  assert.equal(response.json.applications[0].full_name, '100%_Games');
});

test('waitlist search returns submitted experience and filtered count', async () => {
  fake.tables.waitlist.push({ id:randomUUID(), email:'one@example.com', specialty:'Game economy', credits:'Example crafting game' }, { id:randomUUID(), email:'two@example.com', specialty:'Art direction' });
  const response = await get(waitlist, 'q=crafting&limit=25');
  assert.equal(response.json.signups.length, 1);
  assert.equal(response.json.signups[0].email, 'one@example.com');
  assert.equal(response.json.pagination.total, 1);
});

test('invalid page sizes cannot trigger unbounded inbox requests', async () => {
  for (const query of ['page=-1', 'page=1.5', 'limit=0', 'limit=-2', 'limit=500000', 'page=Infinity']) {
    assert.equal((await get(applications, query)).statusCode, 400);
    assert.equal((await get(waitlist, query)).statusCode, 400);
  }
});

test('an email-only repeat signup preserves the original experience', async () => {
  for (const body of [{ email:'return@example.com', specialty:'Game economy', credits:'Shipped an RPG' }, { email:'return@example.com' }]) {
    const response = mockRes();
    await signup(mockReq({ method:'POST', body }), response);
    assert.equal(response.json.ok, true);
  }
  assert.equal(fake.tables.waitlist.length, 1);
  assert.equal(fake.tables.waitlist[0].credits, 'Shipped an RPG');
});

test('modern Supabase keys stay in apikey and never become bearer JWTs', async t => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent = options;
    return new Response('[]', { status:200 });
  });
  await db.select('applications');
  assert.equal(sent.headers.apikey, 'sb_secret_local_test');
  assert.equal(sent.headers.Authorization, undefined);
});

test('missing exact counts are treated as a database error', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('[]', { status:200 }));
  await assert.rejects(db.page('applications', 'limit=25'), /exact count/);
});

test('an offset past the last result returns the new count so the inbox can recover', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ code:'PGRST103', message:'Requested range not satisfiable' }), {
    status:416, headers:{ 'Content-Range':'*/25' },
  }));
  assert.deepEqual(await db.page('applications', 'limit=25&offset=25'), { rows:[], total:25 });
});

test('a missing persistence confirmation is not reported as a successful signup', async t => {
  t.mock.method(db, 'upsert', async () => []);
  const response = mockRes();
  await signup(mockReq({ method:'POST', body:{ email:'test@example.com' } }), response);
  assert.equal(response.statusCode, 500);
  assert.notEqual(response.json.ok, true);
});
