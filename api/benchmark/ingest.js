// POST /api/benchmark/ingest — the only way data enters the benchmark.
//
// Admin-authed. One function rather than five, to stay well inside Vercel's
// Hobby-tier serverless function budget.
//
// Actions:
//   register-model        { slug, name, vendor?, version? }
//   register-environment  { slug, name, description?, genre?, spec?, version? }
//   create-run            { model, environment, artifact_url?, telemetry? }
//   record-score          { run, panelist_email, ratings, comment?, minutes_spent? }
//   finalize-run          { run }        → marks a run 'scored' so it can rank
//
// There is deliberately no action that writes a leaderboard number. The
// leaderboard is a view over `scores`; the only way to move it is to record a
// real scorecard from a real panelist.

import { db } from '../_lib/db.js';
import { json, methodNotAllowed, readJson } from '../_lib/http.js';
import { requireAuth } from '../_lib/auth.js';

const slugRe = /^[a-z0-9][a-z0-9-]{0,60}$/;

/** Every rating must be a number 0..10 against a category that actually exists. */
async function validateRatings(ratings) {
  if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)) {
    return { ok: false, error: 'ratings must be an object of { category_slug: 0..10 }' };
  }

  const entries = Object.entries(ratings);
  if (!entries.length) return { ok: false, error: 'ratings cannot be empty' };

  const categories = await db.select('eval_categories', 'select=slug');
  const known = new Set(categories.map((c) => c.slug));

  const clean = {};
  for (const [slug, raw] of entries) {
    if (!known.has(slug)) {
      return { ok: false, error: `unknown category "${slug}". Known: ${[...known].join(', ')}` };
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 10) {
      return { ok: false, error: `rating for "${slug}" must be a number between 0 and 10` };
    }
    clean[slug] = n;
  }
  return { ok: true, ratings: clean };
}

async function findOne(table, query, label) {
  const rows = await db.select(table, query);
  if (!rows?.length) throw Object.assign(new Error(`No such ${label}.`), { status: 404 });
  return rows[0];
}

export default async function handler(req, res) {
  if (methodNotAllowed(req, res, 'POST')) return;
  if (requireAuth(req, res)) return;

  const body = await readJson(req);
  const action = String(body?.action || '');

  try {
    switch (action) {
      // ── Register a model ────────────────────────────────────────────
      case 'register-model': {
        const slug = String(body.slug || '').toLowerCase();
        if (!slugRe.test(slug)) return json(res, 400, { error: 'slug must be lowercase, alphanumeric and hyphens.' });
        if (!body.name) return json(res, 400, { error: 'name is required.' });

        const [row] = await db.upsert(
          'models',
          [{
            slug,
            name: String(body.name).slice(0, 120),
            vendor: body.vendor ? String(body.vendor).slice(0, 80) : null,
            version: body.version ? String(body.version).slice(0, 40) : null,
          }],
          'slug'
        );
        return json(res, 200, { ok: true, model: row });
      }

      // ── Register an environment ─────────────────────────────────────
      case 'register-environment': {
        const slug = String(body.slug || '').toLowerCase();
        if (!slugRe.test(slug)) return json(res, 400, { error: 'slug must be lowercase, alphanumeric and hyphens.' });
        if (!body.name) return json(res, 400, { error: 'name is required.' });

        const [row] = await db.upsert(
          'environments',
          [{
            slug,
            name: String(body.name).slice(0, 120),
            description: body.description ? String(body.description).slice(0, 2000) : null,
            genre: body.genre ? String(body.genre).slice(0, 60) : null,
            spec: body.spec ? String(body.spec).slice(0, 20000) : null,
            version: body.version ? String(body.version).slice(0, 20) : 'v1',
            is_published: Boolean(body.is_published),
          }],
          'slug'
        );
        return json(res, 200, { ok: true, environment: row });
      }

      // ── Open a run ──────────────────────────────────────────────────
      case 'create-run': {
        const model = await findOne('models', `select=id&slug=eq.${encodeURIComponent(String(body.model))}`, 'model');
        const env = await findOne('environments', `select=id&slug=eq.${encodeURIComponent(String(body.environment))}`, 'environment');

        const [row] = await db.insert('runs', [{
          model_id: model.id,
          environment_id: env.id,
          status: body.artifact_url ? 'complete' : 'queued',
          artifact_url: body.artifact_url ? String(body.artifact_url).slice(0, 500) : null,
          telemetry: body.telemetry && typeof body.telemetry === 'object' ? body.telemetry : {},
          completed_at: body.artifact_url ? new Date().toISOString() : null,
        }]);
        return json(res, 200, { ok: true, run: row });
      }

      // ── Record one panelist's scorecard ─────────────────────────────
      case 'record-score': {
        const run = await findOne('runs', `select=id&id=eq.${encodeURIComponent(String(body.run))}`, 'run');

        // A scorecard must come from an approved panelist. This is the rule
        // that keeps the board meaningful: an unvetted stranger, or a rejected
        // applicant, cannot move a model's score.
        const email = String(body.panelist_email || '').toLowerCase();
        const panelists = await db.select(
          'applications',
          `select=id,status&email=eq.${encodeURIComponent(email)}`
        );
        if (!panelists.length) return json(res, 404, { error: `No applicant with email ${email}.` });
        if (panelists[0].status !== 'approved') {
          return json(res, 403, {
            error: `${email} is "${panelists[0].status}", not an approved panelist. Only approved panelists can score.`,
          });
        }

        const check = await validateRatings(body.ratings);
        if (!check.ok) return json(res, 400, { error: check.error });

        const [row] = await db.upsert(
          'scores',
          [{
            run_id: run.id,
            panelist_id: panelists[0].id,
            ratings: check.ratings,
            comment: body.comment ? String(body.comment).slice(0, 4000) : null,
            minutes_spent: Number.isFinite(Number(body.minutes_spent)) ? Number(body.minutes_spent) : null,
          }],
          'run_id,panelist_id'
        );

        await db.update('runs', `id=eq.${run.id}`, { status: 'scoring' });
        return json(res, 200, { ok: true, score: row });
      }

      // ── Close a run so it can appear on the board ───────────────────
      case 'finalize-run': {
        const id = String(body.run);
        const scores = await db.select('scores', `select=id&run_id=eq.${encodeURIComponent(id)}`);
        if (!scores.length) {
          return json(res, 400, { error: 'Cannot finalize a run with no scorecards.' });
        }

        const rows = await db.update('runs', `id=eq.${encodeURIComponent(id)}`, {
          status: 'scored',
          completed_at: new Date().toISOString(),
        });
        if (!rows?.length) return json(res, 404, { error: 'No such run.' });

        return json(res, 200, { ok: true, run: rows[0], scorecards: scores.length });
      }

      default:
        return json(res, 400, {
          error: 'Unknown action.',
          actions: ['register-model', 'register-environment', 'create-run', 'record-score', 'finalize-run'],
        });
    }
  } catch (err) {
    if (err.status === 404) return json(res, 404, { error: err.message });
    console.error(`[benchmark/ingest:${action}] failed:`, err.message, err.supabase ?? '');
    return json(res, 500, { error: 'Ingest failed.' });
  }
}
