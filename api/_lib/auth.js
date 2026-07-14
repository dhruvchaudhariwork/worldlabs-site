// Admin authentication for the review dashboard.
//
// One shared password (ADMIN_PASSWORD) exchanged for an HMAC-signed session
// cookie. The cookie is httpOnly, so page JavaScript can never read it — the
// browser attaches it automatically and the server is the only thing that sees
// it. Auth is therefore checked server-side on every admin API call; there is
// no client-side "isLoggedIn" flag to bypass by editing the DOM.
//
// Single shared password is the right weight for a one-person review queue.
// If more than a couple of people ever need access, move to per-user accounts.

import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

const COOKIE = 'wl_admin';
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function secret() {
  const v = process.env.SESSION_SECRET;
  if (!v) throw new Error('SESSION_SECRET is not set');
  return v;
}

function sign(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** Compare without leaking length or content through timing. */
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function checkPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error('ADMIN_PASSWORD is not set');
  if (typeof candidate !== 'string' || !candidate) return false;
  return safeEqual(candidate, expected);
}

/** `<expiresAt>.<nonce>.<hmac>` */
export function issueToken() {
  const expiresAt = Date.now() + TTL_MS;
  const nonce = randomBytes(12).toString('base64url');
  const body = `${expiresAt}.${nonce}`;
  return `${body}.${sign(body)}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expiresAt, nonce, mac] = parts;
  if (!safeEqual(mac, sign(`${expiresAt}.${nonce}`))) return false;
  const exp = Number(expiresAt);
  return Number.isFinite(exp) && Date.now() < exp;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${TTL_MS / 1000}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export function isAuthed(req) {
  const token = parseCookies(req.headers?.cookie)[COOKIE];
  return verifyToken(token);
}

/** Guard an admin handler. Returns true if it rejected the request. */
export function requireAuth(req, res) {
  if (isAuthed(req)) return false;
  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ error: 'Not authenticated' }));
  return true;
}
