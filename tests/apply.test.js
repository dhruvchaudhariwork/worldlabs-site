// End-to-end: apply → stored → visible in the admin queue → approved.
// Runs against the in-memory Supabase stand-in, exercising the real handlers.

import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createFakeSupabase } from './fake-supabase.js';
import { mockReq, mockRes, cookieFrom } from './helpers.js';
import { __resetRateLimit } from '../api/_lib/http.js';

const fake = createFakeSupabase();

let applyHandler, loginHandler, listHandler, decideHandler, waitlistHandler, sessionHandler;

const VALID = {
  full_name: 'Jordan Reyes',
  email: 'jordan@studio.com',
  shipped_credits: 'Hollow Tide (2023) — lead systems designer, owned combat and progression.',
  specialties: ['Systems design', 'Level design'],
  years_experience: '8',
  hours_per_week: '5',
  hourly_rate_usd: '120',
  country: 'Japan',
  github_url: 'github.com/jordanreyes',
  heard_from: 'X / Twitter',
};

before(async () => {
  const url = await fake.listen();
  process.env.SUPABASE_URL = url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.ADMIN_PASSWORD = 'correct-horse-battery-staple';
  process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef';

  // Imported after env is set — the handlers read env at call time, but this
  // keeps the ordering unambiguous.
  applyHandler = (await import('../api/apply.js')).default;
  waitlistHandler = (await import('../api/waitlist.js')).default;
  loginHandler = (await import('../api/admin/login.js')).default;
  sessionHandler = (await import('../api/admin/session.js')).default;
  listHandler = (await import('../api/admin/applications.js')).default;
  decideHandler = (await import('../api/admin/decide.js')).default;
});

after(async () => {
  await fake.close();
});

beforeEach(() => {
  fake.reset();
  // The limiter is module-level state keyed by IP, and every test here shares
  // one IP. Without this, tests would throttle each other.
  __resetRateLimit();
});

async function apply(body) {
  const res = mockRes();
  await applyHandler(mockReq({ method: 'POST', url: '/api/apply', body }), res);
  return res;
}

async function adminCookie() {
  const res = mockRes();
  await loginHandler(
    mockReq({ method: 'POST', url: '/api/admin/login', body: { password: 'correct-horse-battery-staple' } }),
    res
  );
  return cookieFrom(res);
}

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/apply', () => {
  test('stores a valid application and reports success', async () => {
    const res = await apply(VALID);

    assert.equal(res.statusCode, 200);
    assert.equal(res.json.ok, true);
    assert.ok(res.json.id, 'should return the new row id');

    assert.equal(fake.tables.applications.length, 1);
    const row = fake.tables.applications[0];
    assert.equal(row.email, 'jordan@studio.com');
    assert.equal(row.status, 'pending');
    assert.deepEqual(row.specialties, ['Systems design', 'Level design']);
    assert.equal(row.years_experience, 8, 'numeric strings are coerced');
  });

  test('rejects a missing name and email, and says which fields', async () => {
    const res = await apply({ ...VALID, full_name: '', email: '' });

    assert.equal(res.statusCode, 400);
    assert.ok(res.json.fields.full_name);
    assert.ok(res.json.fields.email);
    assert.equal(fake.tables.applications.length, 0, 'nothing stored');
  });

  test('rejects a malformed email', async () => {
    const res = await apply({ ...VALID, email: 'not-an-email' });
    assert.equal(res.statusCode, 400);
    assert.ok(res.json.fields.email);
  });

  test('requires shipped credits with substance', async () => {
    const res = await apply({ ...VALID, shipped_credits: 'lots' });
    assert.equal(res.statusCode, 400);
    assert.ok(res.json.fields.shipped_credits);
  });

  test('requires at least one specialty', async () => {
    const res = await apply({ ...VALID, specialties: [] });
    assert.equal(res.statusCode, 400);
    assert.ok(res.json.fields.specialties);
  });

  test('ignores specialties that are not on the offered list', async () => {
    const res = await apply({ ...VALID, specialties: ['Systems design', 'Sorcery', 'Level design'] });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(fake.tables.applications[0].specialties, ['Systems design', 'Level design']);
  });

  test('caps specialties at three even if more are sent', async () => {
    const res = await apply({
      ...VALID,
      specialties: ['Systems design', 'Level design', 'Balance', 'Narrative & quest design', 'Art direction'],
    });
    assert.equal(res.statusCode, 200);
    assert.equal(fake.tables.applications[0].specialties.length, 3);
  });

  test('dedupes a repeated specialty', async () => {
    await apply({ ...VALID, specialties: ['Level design', 'Level design'] });
    assert.deepEqual(fake.tables.applications[0].specialties, ['Level design']);
  });

  test('normalises a bare URL to https', async () => {
    await apply(VALID);
    assert.equal(fake.tables.applications[0].github_url, 'https://github.com/jordanreyes');
  });

  test('rejects a LinkedIn field that is not a LinkedIn URL', async () => {
    const res = await apply({ ...VALID, linkedin_url: 'https://example.com/me' });
    assert.equal(res.statusCode, 400);
    assert.ok(res.json.fields.linkedin_url);
  });

  test('rejects an out-of-range rate', async () => {
    const res = await apply({ ...VALID, hourly_rate_usd: '999999' });
    assert.equal(res.statusCode, 400);
    assert.ok(res.json.fields.hourly_rate_usd);
  });

  test('swallows honeypot spam without storing it', async () => {
    const res = await apply({ ...VALID, company_website: 'http://spam.example' });

    // Looks like success to the bot...
    assert.equal(res.statusCode, 200);
    assert.equal(res.json.ok, true);
    // ...but nothing was written.
    assert.equal(fake.tables.applications.length, 0);
  });

  test('lowercases the email so casing cannot create a duplicate', async () => {
    await apply({ ...VALID, email: 'JORDAN@Studio.com' });
    assert.equal(fake.tables.applications[0].email, 'jordan@studio.com');
  });

  test('re-applying updates the row instead of erroring', async () => {
    await apply(VALID);
    const res = await apply({ ...VALID, hours_per_week: '20' });

    assert.equal(res.statusCode, 200);
    assert.equal(fake.tables.applications.length, 1, 'still one row');
    assert.equal(fake.tables.applications[0].hours_per_week, 20);
  });

  test('re-applying cannot reset an already-approved application to pending', async () => {
    await apply(VALID);
    fake.tables.applications[0].status = 'approved';

    await apply({ ...VALID, hours_per_week: '30' });

    assert.equal(fake.tables.applications[0].status, 'approved', 'status survives a re-submission');
    assert.equal(fake.tables.applications[0].hours_per_week, 30, 'other fields still update');
  });

  test('rejects GET', async () => {
    const res = mockRes();
    await applyHandler(mockReq({ method: 'GET', url: '/api/apply' }), res);
    assert.equal(res.statusCode, 405);
  });

  test('fumbling validation many times does not lock you out of applying', async () => {
    // Someone filling in a long form gets their LinkedIn URL wrong repeatedly.
    // These must not burn the write budget, or a real applicant is locked out
    // of the form for ten minutes for making typos.
    for (let i = 0; i < 12; i++) {
      const res = await apply({ ...VALID, linkedin_url: 'https://example.com/nope' });
      assert.equal(res.statusCode, 400, `attempt ${i + 1} should be a validation error, not a lockout`);
    }

    // They finally get it right, and the application still goes through.
    const ok = await apply(VALID);
    assert.equal(ok.statusCode, 200);
    assert.equal(fake.tables.applications.length, 1);
  });

  test('but a flood of good submissions is throttled', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await apply({ ...VALID, email: `person${i}@studio.com` });
      assert.equal(res.statusCode, 200);
    }
    const sixth = await apply({ ...VALID, email: 'person5@studio.com' });
    assert.equal(sixth.statusCode, 429, 'the write cap still holds');
  });

  test('does not store a raw IP address', async () => {
    await apply(VALID);
    const row = fake.tables.applications[0];
    assert.ok(row.ip_hash, 'an ip_hash is recorded');
    assert.ok(!JSON.stringify(row).includes('10.0.0.1'), 'the raw IP never appears in the row');
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/waitlist', () => {
  test('stores an email', async () => {
    const res = mockRes();
    await waitlistHandler(
      mockReq({ method: 'POST', url: '/api/waitlist', body: { email: 'a@b.com', specialty: 'Game feel' } }),
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(fake.tables.waitlist.length, 1);
    assert.equal(fake.tables.waitlist[0].email, 'a@b.com');
  });

  test('rejects a bad email', async () => {
    const res = mockRes();
    await waitlistHandler(mockReq({ method: 'POST', url: '/api/waitlist', body: { email: 'nope' } }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(fake.tables.waitlist.length, 0);
  });

  test('signing up twice does not duplicate', async () => {
    for (let i = 0; i < 2; i++) {
      const res = mockRes();
      await waitlistHandler(mockReq({ method: 'POST', url: '/api/waitlist', body: { email: 'a@b.com' } }), res);
      assert.equal(res.statusCode, 200);
    }
    assert.equal(fake.tables.waitlist.length, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('admin auth', () => {
  test('the wrong password is refused', async () => {
    const res = mockRes();
    await loginHandler(mockReq({ method: 'POST', url: '/api/admin/login', body: { password: 'hunter2' } }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(cookieFrom(res), null, 'no session cookie is issued');
  });

  test('the right password issues an httpOnly session cookie', async () => {
    const res = mockRes();
    await loginHandler(
      mockReq({ method: 'POST', url: '/api/admin/login', body: { password: 'correct-horse-battery-staple' } }),
      res
    );

    assert.equal(res.statusCode, 200);
    const raw = String(res.getHeader('set-cookie'));
    assert.match(raw, /HttpOnly/, 'page JS must not be able to read the session');
    assert.match(raw, /SameSite=Strict/);
  });

  test('the queue is closed to anyone without a session', async () => {
    const res = mockRes();
    await listHandler(mockReq({ method: 'GET', url: '/api/admin/applications' }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.json.applications, undefined, 'no applicant data leaks');
  });

  test('a forged cookie is refused', async () => {
    const res = mockRes();
    await listHandler(
      mockReq({ method: 'GET', url: '/api/admin/applications', cookie: 'wl_admin=9999999999999.abc.forged' }),
      res
    );
    assert.equal(res.statusCode, 401);
  });

  test('an expired token is refused', async () => {
    // Sign a token that is validly signed but already past its expiry.
    const { createHmac } = await import('node:crypto');
    const body = `${Date.now() - 1000}.nonce`;
    const mac = createHmac('sha256', process.env.SESSION_SECRET).update(body).digest('base64url');

    const res = mockRes();
    await listHandler(
      mockReq({ method: 'GET', url: '/api/admin/applications', cookie: `wl_admin=${body}.${mac}` }),
      res
    );
    assert.equal(res.statusCode, 401);
  });

  test('decide is closed to anyone without a session', async () => {
    await apply(VALID);
    const id = fake.tables.applications[0].id;

    const res = mockRes();
    await decideHandler(mockReq({ method: 'POST', url: '/api/admin/decide', body: { id, status: 'approved' } }), res);

    assert.equal(res.statusCode, 401);
    assert.equal(fake.tables.applications[0].status, 'pending', 'unchanged');
  });

  test('session endpoint reports the truth', async () => {
    const anon = mockRes();
    await sessionHandler(mockReq({ url: '/api/admin/session' }), anon);
    assert.equal(anon.json.authed, false);

    const cookie = await adminCookie();
    const authed = mockRes();
    await sessionHandler(mockReq({ url: '/api/admin/session', cookie }), authed);
    assert.equal(authed.json.authed, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('the review queue', () => {
  test('lists applications and counts them by status', async () => {
    await apply(VALID);
    await apply({ ...VALID, email: 'sam@studio.com', full_name: 'Sam Okafor' });

    const cookie = await adminCookie();
    const res = mockRes();
    await listHandler(mockReq({ method: 'GET', url: '/api/admin/applications?status=pending', cookie }), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.json.applications.length, 2);
    assert.equal(res.json.counts.pending, 2);
    assert.equal(res.json.counts.approved, 0);
  });

  test('filters by status', async () => {
    await apply(VALID);
    await apply({ ...VALID, email: 'sam@studio.com' });
    fake.tables.applications[0].status = 'approved';

    const cookie = await adminCookie();
    const res = mockRes();
    await listHandler(mockReq({ method: 'GET', url: '/api/admin/applications?status=approved', cookie }), res);

    assert.equal(res.json.applications.length, 1);
    assert.equal(res.json.applications[0].email, 'jordan@studio.com');
  });

  test('searches across name, email and credits', async () => {
    await apply(VALID);
    await apply({ ...VALID, email: 'sam@studio.com', full_name: 'Sam Okafor', shipped_credits: 'Ninefold (2021) — level designer on fourteen shipped levels.' });

    const cookie = await adminCookie();
    const res = mockRes();
    await listHandler(mockReq({ method: 'GET', url: '/api/admin/applications?status=all&q=Ninefold', cookie }), res);

    assert.equal(res.json.applications.length, 1);
    assert.equal(res.json.applications[0].full_name, 'Sam Okafor');
  });

  test('rejects an unknown status rather than silently returning everything', async () => {
    const cookie = await adminCookie();
    const res = mockRes();
    await listHandler(mockReq({ method: 'GET', url: '/api/admin/applications?status=deleted', cookie }), res);
    assert.equal(res.statusCode, 400);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('approving and rejecting', () => {
  test('approves an application and timestamps the review', async () => {
    await apply(VALID);
    const id = fake.tables.applications[0].id;
    const cookie = await adminCookie();

    const res = mockRes();
    await decideHandler(
      mockReq({ method: 'POST', url: '/api/admin/decide', body: { id, status: 'approved', admin_notes: 'Strong credits.' }, cookie }),
      res
    );

    assert.equal(res.statusCode, 200);
    const row = fake.tables.applications[0];
    assert.equal(row.status, 'approved');
    assert.equal(row.admin_notes, 'Strong credits.');
    assert.ok(row.reviewed_at, 'reviewed_at is set');
  });

  test('rejects an application', async () => {
    await apply(VALID);
    const id = fake.tables.applications[0].id;
    const cookie = await adminCookie();

    const res = mockRes();
    await decideHandler(mockReq({ method: 'POST', url: '/api/admin/decide', body: { id, status: 'rejected' }, cookie }), res);

    assert.equal(res.statusCode, 200);
    assert.equal(fake.tables.applications[0].status, 'rejected');
  });

  test('saves notes without changing status', async () => {
    await apply(VALID);
    const id = fake.tables.applications[0].id;
    const cookie = await adminCookie();

    const res = mockRes();
    await decideHandler(mockReq({ method: 'POST', url: '/api/admin/decide', body: { id, admin_notes: 'Chasing a portfolio link.' }, cookie }), res);

    assert.equal(res.statusCode, 200);
    assert.equal(fake.tables.applications[0].status, 'pending', 'status untouched');
    assert.equal(fake.tables.applications[0].admin_notes, 'Chasing a portfolio link.');
  });

  test('refuses an invalid status', async () => {
    await apply(VALID);
    const id = fake.tables.applications[0].id;
    const cookie = await adminCookie();

    const res = mockRes();
    await decideHandler(mockReq({ method: 'POST', url: '/api/admin/decide', body: { id, status: 'promoted' }, cookie }), res);

    assert.equal(res.statusCode, 400);
    assert.equal(fake.tables.applications[0].status, 'pending');
  });

  test('refuses an id that is not a UUID, rather than passing it to the query', async () => {
    const cookie = await adminCookie();
    const res = mockRes();
    await decideHandler(
      mockReq({ method: 'POST', url: '/api/admin/decide', body: { id: 'or.1=1', status: 'approved' }, cookie }),
      res
    );
    assert.equal(res.statusCode, 400);
  });

  test('404s on an application that does not exist', async () => {
    const cookie = await adminCookie();
    const res = mockRes();
    await decideHandler(
      mockReq({
        method: 'POST',
        url: '/api/admin/decide',
        body: { id: '11111111-2222-3333-4444-555555555555', status: 'approved' },
        cookie,
      }),
      res
    );
    assert.equal(res.statusCode, 404);
  });
});
