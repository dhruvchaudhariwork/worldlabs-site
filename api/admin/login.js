// POST /api/admin/login — exchange the shared password for a session cookie.

import { json, methodNotAllowed, readJson, clientIp, hashIp, rateLimit } from '../_lib/http.js';
import { checkPassword, issueToken, sessionCookie } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (methodNotAllowed(req, res, 'POST')) return;

  // Brute-force guard. Slow enough that guessing a decent password is hopeless.
  const ip_hash = hashIp(clientIp(req));
  const limit = rateLimit(`login:${ip_hash}`, { max: 8, windowMs: 15 * 60_000 });
  if (!limit.ok) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return json(res, 429, { error: 'Too many attempts. Try again later.' });
  }

  const body = await readJson(req);

  let ok = false;
  try {
    ok = checkPassword(body?.password);
  } catch (err) {
    console.error('[admin/login] misconfigured:', err.message);
    return json(res, 500, { error: 'Admin auth is not configured on the server.' });
  }

  if (!ok) return json(res, 401, { error: 'Incorrect password.' });

  res.setHeader('Set-Cookie', sessionCookie(issueToken()));
  return json(res, 200, { ok: true });
}
