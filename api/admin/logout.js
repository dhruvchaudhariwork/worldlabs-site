// POST /api/admin/logout

import { json, methodNotAllowed } from '../_lib/http.js';
import { clearCookie } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (methodNotAllowed(req, res, 'POST')) return;
  res.setHeader('Set-Cookie', clearCookie());
  return json(res, 200, { ok: true });
}
