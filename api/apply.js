// POST /api/apply — a panel application.

import { db } from './_lib/db.js';
import { json, methodNotAllowed, readJson, clientIp, hashIp, rateLimit } from './_lib/http.js';
import { validateApplication, isSpam } from './_lib/validate.js';

export default async function handler(req, res) {
  if (methodNotAllowed(req, res, 'POST')) return;

  const ip = clientIp(req);
  const ip_hash = hashIp(ip);

  // Two tiers, deliberately.
  //
  // A coarse cap on every request stops a flood. It has to be generous,
  // because correcting validation errors is a normal part of filling in a long
  // form — an applicant who fumbles their LinkedIn URL a few times must not be
  // locked out of applying.
  const flood = rateLimit(`apply:req:${ip_hash}`, { max: 30, windowMs: 10 * 60_000 });
  if (!flood.ok) {
    res.setHeader('Retry-After', Math.ceil(flood.retryAfterMs / 1000));
    return json(res, 429, { error: 'Too many attempts. Try again in a few minutes.' });
  }

  const body = await readJson(req);

  // Silently accept spam. Telling a bot it failed just teaches it to retry.
  if (isSpam(body)) {
    return json(res, 200, { ok: true, status: 'received' });
  }

  const result = validateApplication(body);
  if (!result.ok) {
    return json(res, 400, { error: 'Please fix the highlighted fields.', fields: result.errors });
  }

  // The tight cap applies only to submissions good enough to actually hit the
  // database, so it throttles writes without punishing typos.
  const writes = rateLimit(`apply:write:${ip_hash}`, { max: 5, windowMs: 10 * 60_000 });
  if (!writes.ok) {
    res.setHeader('Retry-After', Math.ceil(writes.retryAfterMs / 1000));
    return json(res, 429, { error: 'Too many submissions. Try again in a few minutes.' });
  }

  const row = {
    ...result.value,
    ip_hash,
    user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
  };

  try {
    // Upsert on email: re-applying updates your application instead of
    // failing on the unique index. `status` is deliberately not in the
    // payload, so a re-submission can never reset an already-reviewed
    // application back to pending.
    const [saved] = await db.upsert('applications', [row], 'email');

    return json(res, 200, {
      ok: true,
      status: 'received',
      id: saved?.id ?? null,
    });
  } catch (err) {
    console.error('[apply] insert failed:', err.message, err.supabase ?? '');
    return json(res, 500, {
      error: 'Something broke on our end. Email hello@tryworldlabs.com and we’ll sort it out.',
    });
  }
}
