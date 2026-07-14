// The benchmark pipeline: register → run → score → finalize → rank.
//
// The load-bearing tests here are the ones about what CANNOT happen: a score
// from someone who isn't an approved panelist, and a ranking that appears
// before it has cleared quorum.

import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createFakeSupabase } from './fake-supabase.js';
import { mockReq, mockRes, cookieFrom } from './helpers.js';
import { __resetRateLimit } from '../api/_lib/http.js';

const fake = createFakeSupabase();
let ingest, leaderboard, login, applyHandler, decide;

const PASSWORD = 'correct-horse-battery-staple';

before(async () => {
  const url = await fake.listen();
  process.env.SUPABASE_URL = url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.ADMIN_PASSWORD = PASSWORD;
  process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef';

  ingest = (await import('../api/benchmark/ingest.js')).default;
  leaderboard = (await import('../api/benchmark/leaderboard.js')).default;
  login = (await import('../api/admin/login.js')).default;
  applyHandler = (await import('../api/apply.js')).default;
  decide = (await import('../api/admin/decide.js')).default;
});

after(() => fake.close());
beforeEach(() => {
  fake.reset();
  __resetRateLimit();
});

async function adminCookie() {
  const res = mockRes();
  await login(mockReq({ method: 'POST', url: '/api/admin/login', body: { password: PASSWORD } }), res);
  return cookieFrom(res);
}

async function call(body, cookie) {
  const res = mockRes();
  await ingest(mockReq({ method: 'POST', url: '/api/benchmark/ingest', body, cookie }), res);
  return res;
}

async function board() {
  const res = mockRes();
  await leaderboard(mockReq({ url: '/api/benchmark/leaderboard' }), res);
  return res;
}

/** Create an approved panelist and return their email. */
async function makePanelist(cookie, email, status = 'approved') {
  const ares = mockRes();
  await applyHandler(
    mockReq({
      method: 'POST',
      url: '/api/apply',
      body: {
        full_name: `Panelist ${email}`,
        email,
        shipped_credits: 'Hollow Tide (2023) — lead systems designer on combat and progression.',
        specialties: ['Systems design'],
      },
    }),
    ares
  );

  const id = ares.json.id;
  if (status !== 'pending') {
    const dres = mockRes();
    await decide(mockReq({ method: 'POST', url: '/api/admin/decide', body: { id, status }, cookie }), dres);
  }
  return email;
}

const FULL_CARD = {
  'game-mechanics': 8,
  'level-design': 7,
  'balance': 6,
};

// ─────────────────────────────────────────────────────────────────────────
describe('the leaderboard starts honest', () => {
  test('reports empty rather than inventing rows', async () => {
    const res = await board();
    assert.equal(res.statusCode, 200);
    assert.equal(res.json.empty, true);
    assert.deepEqual(res.json.ranked, []);
    assert.deepEqual(res.json.provisional, []);
  });

  test('exposes the 14 published categories', async () => {
    const res = await board();
    assert.equal(res.json.categories.length, 14);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('ingest is closed to the public', () => {
  test('registering a model without a session is refused', async () => {
    const res = await call({ action: 'register-model', slug: 'gpt-x', name: 'GPT-X' });
    assert.equal(res.statusCode, 401);
    assert.equal(fake.tables.models.length, 0);
  });

  test('recording a score without a session is refused', async () => {
    const res = await call({ action: 'record-score', run: 'x', panelist_email: 'a@b.com', ratings: FULL_CARD });
    assert.equal(res.statusCode, 401);
    assert.equal(fake.tables.scores.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('scores can only come from approved panelists', () => {
  test('an approved panelist can score', async () => {
    const cookie = await adminCookie();
    await call({ action: 'register-model', slug: 'model-a', name: 'Model A' }, cookie);
    await call({ action: 'register-environment', slug: 'env-a', name: 'Env A' }, cookie);
    const run = await call({ action: 'create-run', model: 'model-a', environment: 'env-a', artifact_url: 'https://example.com/build' }, cookie);

    const email = await makePanelist(cookie, 'approved@studio.com', 'approved');
    const res = await call({ action: 'record-score', run: run.json.run.id, panelist_email: email, ratings: FULL_CARD }, cookie);

    assert.equal(res.statusCode, 200);
    assert.equal(fake.tables.scores.length, 1);
  });

  test('a PENDING applicant cannot score', async () => {
    const cookie = await adminCookie();
    await call({ action: 'register-model', slug: 'model-a', name: 'Model A' }, cookie);
    await call({ action: 'register-environment', slug: 'env-a', name: 'Env A' }, cookie);
    const run = await call({ action: 'create-run', model: 'model-a', environment: 'env-a' }, cookie);

    const email = await makePanelist(cookie, 'pending@studio.com', 'pending');
    const res = await call({ action: 'record-score', run: run.json.run.id, panelist_email: email, ratings: FULL_CARD }, cookie);

    assert.equal(res.statusCode, 403);
    assert.equal(fake.tables.scores.length, 0, 'no score is recorded');
  });

  test('a REJECTED applicant cannot score', async () => {
    const cookie = await adminCookie();
    await call({ action: 'register-model', slug: 'model-a', name: 'Model A' }, cookie);
    await call({ action: 'register-environment', slug: 'env-a', name: 'Env A' }, cookie);
    const run = await call({ action: 'create-run', model: 'model-a', environment: 'env-a' }, cookie);

    const email = await makePanelist(cookie, 'rejected@studio.com', 'rejected');
    const res = await call({ action: 'record-score', run: run.json.run.id, panelist_email: email, ratings: FULL_CARD }, cookie);

    assert.equal(res.statusCode, 403);
    assert.equal(fake.tables.scores.length, 0);
  });

  test('a stranger cannot score', async () => {
    const cookie = await adminCookie();
    await call({ action: 'register-model', slug: 'model-a', name: 'Model A' }, cookie);
    await call({ action: 'register-environment', slug: 'env-a', name: 'Env A' }, cookie);
    const run = await call({ action: 'create-run', model: 'model-a', environment: 'env-a' }, cookie);

    const res = await call({ action: 'record-score', run: run.json.run.id, panelist_email: 'nobody@nowhere.com', ratings: FULL_CARD }, cookie);
    assert.equal(res.statusCode, 404);
  });

  test('one panelist gets one scorecard per run, not many', async () => {
    const cookie = await adminCookie();
    await call({ action: 'register-model', slug: 'model-a', name: 'Model A' }, cookie);
    await call({ action: 'register-environment', slug: 'env-a', name: 'Env A' }, cookie);
    const run = await call({ action: 'create-run', model: 'model-a', environment: 'env-a' }, cookie);
    const email = await makePanelist(cookie, 'p1@studio.com');

    await call({ action: 'record-score', run: run.json.run.id, panelist_email: email, ratings: { 'balance': 3 } }, cookie);
    await call({ action: 'record-score', run: run.json.run.id, panelist_email: email, ratings: { 'balance': 9 } }, cookie);

    assert.equal(fake.tables.scores.length, 1, 'the second scorecard replaces the first');
    assert.equal(fake.tables.scores[0].ratings.balance, 9);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('ratings are validated', () => {
  async function setup() {
    const cookie = await adminCookie();
    await call({ action: 'register-model', slug: 'model-a', name: 'Model A' }, cookie);
    await call({ action: 'register-environment', slug: 'env-a', name: 'Env A' }, cookie);
    const run = await call({ action: 'create-run', model: 'model-a', environment: 'env-a' }, cookie);
    const email = await makePanelist(cookie, 'p1@studio.com');
    return { cookie, runId: run.json.run.id, email };
  }

  test('an unknown category is refused', async () => {
    const { cookie, runId, email } = await setup();
    const res = await call({ action: 'record-score', run: runId, panelist_email: email, ratings: { vibes: 10 } }, cookie);
    assert.equal(res.statusCode, 400);
    assert.match(res.json.error, /unknown category/i);
  });

  test('a rating above 10 is refused', async () => {
    const { cookie, runId, email } = await setup();
    const res = await call({ action: 'record-score', run: runId, panelist_email: email, ratings: { balance: 11 } }, cookie);
    assert.equal(res.statusCode, 400);
  });

  test('a non-numeric rating is refused', async () => {
    const { cookie, runId, email } = await setup();
    const res = await call({ action: 'record-score', run: runId, panelist_email: email, ratings: { balance: 'great' } }, cookie);
    assert.equal(res.statusCode, 400);
  });

  test('an empty scorecard is refused', async () => {
    const { cookie, runId, email } = await setup();
    const res = await call({ action: 'record-score', run: runId, panelist_email: email, ratings: {} }, cookie);
    assert.equal(res.statusCode, 400);
  });

  test('a partial scorecard is fine — panelists judge only what they know', async () => {
    const { cookie, runId, email } = await setup();
    const res = await call({ action: 'record-score', run: runId, panelist_email: email, ratings: { 'level-design': 7 } }, cookie);
    assert.equal(res.statusCode, 200);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('quorum', () => {
  /** Score one run with n distinct approved panelists, then finalize it. */
  async function runScoredBy(n, ratingsPerPanelist) {
    const cookie = await adminCookie();
    await call({ action: 'register-model', slug: 'model-a', name: 'Model A', vendor: 'Acme' }, cookie);
    await call({ action: 'register-environment', slug: 'env-a', name: 'Env A' }, cookie);
    const run = await call({ action: 'create-run', model: 'model-a', environment: 'env-a', artifact_url: 'https://example.com/b' }, cookie);
    const runId = run.json.run.id;

    for (let i = 0; i < n; i++) {
      const email = await makePanelist(cookie, `p${i}@studio.com`);
      await call(
        { action: 'record-score', run: runId, panelist_email: email, ratings: ratingsPerPanelist?.[i] ?? FULL_CARD },
        cookie
      );
    }

    await call({ action: 'finalize-run', run: runId }, cookie);
    return { cookie, runId };
  }

  test('a model scored by only 2 panelists is held back, not ranked', async () => {
    await runScoredBy(2);
    const res = await board();

    assert.equal(res.json.ranked.length, 0, 'nothing ranked below quorum');
    assert.equal(res.json.provisional.length, 1, 'held as provisional');
    assert.equal(res.json.empty, false);
  });

  test('a model scored by 3 panelists is ranked', async () => {
    await runScoredBy(3);
    const res = await board();

    assert.equal(res.json.ranked.length, 1);
    assert.equal(res.json.ranked[0].model_name, 'Model A');
    assert.equal(res.json.ranked[0].rank, 1);
    assert.equal(res.json.ranked[0].n_panelists, 3);
  });

  test('the score is the median across panelists, so one outlier cannot swing it', async () => {
    // Two panelists say 8, one says 0. The median is 8, not the mean of 5.33.
    await runScoredBy(3, [
      { balance: 8 },
      { balance: 8 },
      { balance: 0 },
    ]);

    const res = await board();
    assert.equal(res.json.ranked[0].overall_score, 8, 'the outlier is absorbed');
  });

  test('a run with no scorecards cannot be finalized onto the board', async () => {
    const cookie = await adminCookie();
    await call({ action: 'register-model', slug: 'model-a', name: 'Model A' }, cookie);
    await call({ action: 'register-environment', slug: 'env-a', name: 'Env A' }, cookie);
    const run = await call({ action: 'create-run', model: 'model-a', environment: 'env-a' }, cookie);

    const res = await call({ action: 'finalize-run', run: run.json.run.id }, cookie);
    assert.equal(res.statusCode, 400);

    const b = await board();
    assert.equal(b.json.empty, true, 'the board is still empty');
  });

  test('an unscored run never reaches the board', async () => {
    const cookie = await adminCookie();
    await call({ action: 'register-model', slug: 'model-a', name: 'Model A' }, cookie);
    await call({ action: 'register-environment', slug: 'env-a', name: 'Env A' }, cookie);
    await call({ action: 'create-run', model: 'model-a', environment: 'env-a' }, cookie);

    const res = await board();
    assert.equal(res.json.empty, true);
  });
});
