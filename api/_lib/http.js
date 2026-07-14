// Small HTTP helpers shared by the serverless functions.

import { createHash } from 'node:crypto';

export function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

/** Guard a handler to a single method. Returns true if the request was handled (and you should return). */
export function methodNotAllowed(req, res, allowed) {
  if (req.method === allowed) return false;
  res.setHeader('Allow', allowed);
  json(res, 405, { error: 'Method not allowed' });
  return true;
}

/**
 * Vercel parses JSON bodies for us, but `vercel dev` and our local dev server
 * can hand back a raw string. Normalise both, and never throw on bad JSON.
 */
export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Store a salted hash of the IP, never the IP itself. Enough to spot one
 * address spamming the form; not enough to be a log of who visited.
 */
export function hashIp(ip) {
  const salt = process.env.SESSION_SECRET || 'worldlabs-dev-salt';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

/**
 * Fixed-window in-memory rate limit. Serverless instances are ephemeral and
 * not shared, so this throttles a naive flood but is not a hard guarantee.
 * The real backstop is the unique index on email plus the honeypot.
 */
const hits = new Map();

export function rateLimit(kee, { max = 5, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const rec = hits.get(kee);
  if (!rec || now > rec.resetAt) {
    hits.set(kee, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1 };
  }
  rec.count += 1;
  if (rec.count > max) {
    return { ok: false, retryAfterMs: rec.resetAt - now };
  }
  return { ok: true, remaining: max - rec.count };
}

/** Keep the map from growing without bound across a warm instance's life. */
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
}, 60_000).unref?.();

/** Test-only: the limiter is module state, so suites must be able to clear it. */
export function __resetRateLimit() {
  hits.clear();
}
