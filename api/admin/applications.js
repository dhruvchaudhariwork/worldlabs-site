// Private, paginated application review queue.
import { db } from '../_lib/db.js';
import { json, methodNotAllowed } from '../_lib/http.js';
import { requireAuth } from '../_lib/auth.js';
import { STATUSES, listQuery, pagination } from '../_lib/admin-list.js';

export default async function handler(req, res) {
  if (methodNotAllowed(req, res, 'GET')) return;
  if (requireAuth(req, res)) return;
  const options = listQuery(req, ['full_name', 'email', 'shipped_credits']);
  if (options.error) return json(res, 400, { error: options.error });
  if (options.status !== 'all') {
    if (!STATUSES.includes(options.status)) return json(res, 400, { error: 'Choose a valid review status.' });
    options.query.set('status', `eq.${options.status}`);
  }
  try {
    const [result, ...totals] = await Promise.all([
      db.page('applications', options.query.toString()),
      ...STATUSES.map(status => db.count('applications', `status=eq.${status}`)),
    ]);
    const counts = Object.fromEntries(STATUSES.map((status, i) => [status, totals[i]]));
    return json(res, 200, {
      ok: true, applications: result.rows, counts,
      total: totals.reduce((sum, n) => sum + n, 0),
      pagination: pagination(options, result.total),
    });
  } catch (error) {
    console.error('[admin/applications]', error.message);
    return json(res, 500, { error: 'Could not load applications. Please try again.' });
  }
}
