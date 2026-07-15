// POST /api/waitlist — the lightweight signup on join.html.
// GET  /api/waitlist — the milestone the community page shows as social proof.
//
// This replaces a handler that faked success in the browser and stored nothing.

import { db } from './_lib/db.js';
import { json, readJson, clientIp, hashIp, rateLimit } from './_lib/http.js';
import { isSpam } from './_lib/validate.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// The public count is a floor, never the exact figure, and it stays null until
// the first milestone is genuinely cleared — the page shows nothing rather
// than a small or invented number.
const MILESTONES = [25, 50, 100, 150, 200, 300, 500, 750, 1000];

export function milestoneFor(total) {
  if (total >= 2000) return Math.floor(total / 1000) * 1000;
  let hit = null;
  for (const m of MILESTONES) if (total >= m) hit = m;
  return hit;
}

async function communityMilestone(res) {
  try {
    const [waitlist, applications] = await Promise.all([
      db.select('waitlist', 'select=id'),
      db.select('applications', 'select=id'),
    ]);
    return json(res, 200, { milestone: milestoneFor(waitlist.length + applications.length) });
  } catch (err) {
    console.error('[waitlist] count failed:', err.message, err.supabase ?? '');
    return json(res, 500, { error: 'Could not load the count.' });
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') return communityMilestone(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

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
