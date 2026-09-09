// Waitlist emails and credits are available only to the signed-in admin.
import { db } from '../_lib/db.js';
import { json, methodNotAllowed } from '../_lib/http.js';
import { requireAuth } from '../_lib/auth.js';
import { listQuery, pagination } from '../_lib/admin-list.js';

export default async function handler(req, res) {
  if (methodNotAllowed(req, res, 'GET')) return;
  if (requireAuth(req, res)) return;
  const options = listQuery(req, ['email', 'specialty', 'credits']);
  if (options.error) return json(res, 400, { error: options.error });
  try {
    const result = await db.page('waitlist', options.query.toString());
    return json(res, 200, { ok: true, signups: result.rows, pagination: pagination(options, result.total) });
  } catch (error) {
    console.error('[admin/waitlist]', error.message);
    return json(res, 500, { error: 'Could not load signups. Please try again.' });
  }
}
