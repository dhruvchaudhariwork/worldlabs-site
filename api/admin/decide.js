// POST /api/admin/decide — approve, reject, or annotate an application.
//
// Body: { id, status?, admin_notes? }

import { db } from '../_lib/db.js';
import { json, methodNotAllowed, readJson } from '../_lib/http.js';
import { requireAuth } from '../_lib/auth.js';

const STATUSES = ['pending', 'reviewing', 'approved', 'rejected'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (methodNotAllowed(req, res, 'POST')) return;
  if (requireAuth(req, res)) return;

  const body = await readJson(req);
  const id = String(body?.id || '');

  // Must be a well-formed UUID before it goes anywhere near a query string.
  if (!UUID_RE.test(id)) return json(res, 400, { error: 'Invalid application id.' });

  const patch = {};

  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return json(res, 400, { error: `status must be one of: ${STATUSES.join(', ')}` });
    }
    patch.status = body.status;
    patch.reviewed_at = new Date().toISOString();
    patch.reviewed_by = 'admin';
  }

  if (body?.admin_notes !== undefined) {
    patch.admin_notes = String(body.admin_notes).slice(0, 4000) || null;
  }

  if (!Object.keys(patch).length) {
    return json(res, 400, { error: 'Nothing to update.' });
  }

  try {
    const rows = await db.update('applications', `id=eq.${id}`, patch);
    if (!rows?.length) return json(res, 404, { error: 'No such application.' });
    return json(res, 200, { ok: true, application: rows[0] });
  } catch (err) {
    console.error('[admin/decide] update failed:', err.message, err.supabase ?? '');
    return json(res, 500, { error: 'Could not update the application.' });
  }
}
