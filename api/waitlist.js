// POST /api/waitlist — the lightweight signup on join.html.
//
// This replaces a handler that faked success in the browser and stored nothing.

import { db } from './_lib/db.js';
import { json, methodNotAllowed, readJson, clientIp, hashIp, rateLimit } from './_lib/http.js';
import { isSpam } from './_lib/validate.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (methodNotAllowed(req, res, 'POST')) return;

  const ip_hash = hashIp(clientIp(req));

  const limit = rateLimit(`waitlist:${ip_hash}`, { max: 5, windowMs: 10 * 60_000 });
  if (!limit.ok) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return json(res, 429, { error: 'Too many attempts. Try again shortly.' });
  }

  const body = await readJson(req);
  if (isSpam(body)) return json(res, 200, { ok: true });

  const email = String(body?.email || '').trim().toLowerCase().slice(0, 200);
  if (!EMAIL_RE.test(email)) {
    return json(res, 400, { error: 'Enter a valid email address.', fields: { email: 'Enter a valid email address.' } });
  }

  const row = {
    email,
    specialty: String(body?.specialty || '').trim().slice(0, 80) || null,
    credits: String(body?.credits || '').trim().slice(0, 2000) || null,
    ip_hash,
  };

  try {
    await db.upsert('waitlist', [row], 'email');
    return json(res, 200, { ok: true });
  } catch (err) {
    console.error('[waitlist] insert failed:', err.message, err.supabase ?? '');
    return json(res, 500, { error: 'Something broke on our end. Try again in a moment.' });
  }
}
