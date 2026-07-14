// GET /api/admin/applications?status=pending&q=doom&limit=100
//
// The review queue. Auth-gated: this returns applicants' emails and rates.

import { db } from '../_lib/db.js';
import { json, methodNotAllowed } from '../_lib/http.js';
import { requireAuth } from '../_lib/auth.js';

const STATUSES = ['pending', 'reviewing', 'approved', 'rejected'];

export default async function handler(req, res) {
  if (methodNotAllowed(req, res, 'GET')) return;
  if (requireAuth(req, res)) return;

  const url = new URL(req.url, 'http://localhost');
  const status = url.searchParams.get('status');
  const q = (url.searchParams.get('q') || '').trim();
  const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 500);

  const parts = ['select=*', `limit=${limit}`, 'order=created_at.desc'];

  if (status && status !== 'all') {
    if (!STATUSES.includes(status)) {
      return json(res, 400, { error: `status must be one of: ${STATUSES.join(', ')}, all` });
    }
    parts.push(`status=eq.${status}`);
  }

  if (q) {
    // PostgREST `or=` with ilike. Commas and parens would break out of the
    // filter grammar, so strip them rather than trusting the input.
    const safe = q.replace(/[(),*]/g, '').slice(0, 80);
    if (safe) {
      parts.push(
        `or=(full_name.ilike.*${safe}*,email.ilike.*${safe}*,shipped_credits.ilike.*${safe}*)`
      );
    }
  }

  try {
    const rows = await db.select('applications', parts.join('&'));

    const counts = { pending: 0, reviewing: 0, approved: 0, rejected: 0 };
    const all = await db.select('applications', 'select=status');
    for (const r of all) if (r.status in counts) counts[r.status] += 1;

    return json(res, 200, { ok: true, applications: rows, counts, total: all.length });
  } catch (err) {
    console.error('[admin/applications] query failed:', err.message, err.supabase ?? '');
    return json(res, 500, { error: 'Could not load applications.' });
  }
}
