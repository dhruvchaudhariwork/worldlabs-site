// GET /api/benchmark/leaderboard
//
// Public. Reads the `leaderboard` view, which is derived from real panelist
// scorecards — there is no table of leaderboard numbers to hand-edit. If no
// runs have been scored, this returns an empty array and the page says so.
//
// QUORUM: a model is only ranked once its runs have been scored by at least
// MIN_PANELISTS independent panelists. Below that, we hold it back as
// provisional rather than publishing a number a single reviewer could swing.

import { db } from '../_lib/db.js';
import { json, methodNotAllowed } from '../_lib/http.js';

const MIN_PANELISTS = 3;

export default async function handler(req, res) {
  if (methodNotAllowed(req, res, 'GET')) return;

  try {
    const [rows, categories] = await Promise.all([
      db.select('leaderboard', 'select=*&order=overall_score.desc'),
      db.select('eval_categories', 'select=*&order=sort_order.asc'),
    ]);

    const ranked = [];
    const provisional = [];

    for (const r of rows ?? []) {
      (r.n_panelists >= MIN_PANELISTS ? ranked : provisional).push(r);
    }

    ranked.forEach((r, i) => {
      r.rank = i + 1;
    });

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return json(res, 200, {
      ok: true,
      quorum: MIN_PANELISTS,
      categories: categories ?? [],
      ranked,
      provisional,
      // An explicit flag so the page never has to guess whether "no rows"
      // means "still loading", "broken", or "genuinely nothing scored yet".
      empty: ranked.length === 0 && provisional.length === 0,
    });
  } catch (err) {
    console.error('[benchmark/leaderboard] query failed:', err.message, err.supabase ?? '');
    return json(res, 500, { error: 'Could not load the leaderboard.' });
  }
}
