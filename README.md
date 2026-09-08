# World Labs

Expert gaming datasets for AI training and evaluation, with initial projects in development. Static site plus a small
serverless backend configured for Vercel.

## Current product status

The public site describes proposed expert-data projects: prompts, critiques, comparisons, and revisions across gaming domains. The repository implements
applications, a waitlist, admin review, and experimental scorecard storage;
it does not implement an RL training environment or a validated eval harness.
The benchmark page is a minimal white "In progress" screen with an animated
hourglass and a link home. It does not fetch or display experimental ranks.
The existing leaderboard API remains available and is not a publication gate.
The new project examples are descriptive; there is no implemented prompt, pairwise-label, or dataset-delivery workflow yet.

See `docs/market-positioning-review-2026-09-08.md` for source-linked positioning,
implementation gaps, and the checks needed before publishing comparisons.
The [site quality pass](docs/site-quality-pass-2026-09-08.md) records the
readability, form, navigation, and browser checks completed for the local preview.

## Getting it running

Install Node.js 20 or later. The site has no runtime packages to install.
For a quick local preview without a database, run `npm run demo` and open
`http://localhost:3000`. Demo applications and signups stay in memory and are
lost when the server stops.

To connect the API to Supabase, put these four environment variables in
`.env.local` (gitignored — never commit it):

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhb...        # Supabase → Settings → API → service_role
ADMIN_PASSWORD=<pick a long one>          # gates /admin
SESSION_SECRET=<64 random hex chars>      # signs admin session cookies
```

Generate a session secret with:

```bash
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

Then:

```bash
npm run setup     # checks env, connectivity, schema, and that RLS is locked down
npm run dev       # http://localhost:3000
npm test          # automated tests, no network needed
```

In Windows PowerShell, use `npm.cmd` if the execution policy blocks `npm.ps1`.

### Applying the schema

Supabase's REST API can't run DDL, so this is a copy-paste, once:

> Supabase → SQL Editor → New query → paste all of `sql/001_init.sql` → Run.

`npm run setup` will tell you if you haven't.

### Trying it without Supabase

```bash
npm run demo      # in-memory database, admin password "demo"
```

The demo exercises applications, waitlist signups, and admin review using an
in-memory database. It does not verify production persistence or delivery.
Set the `PORT` environment variable before starting it to use a different port.

### Browser checks

The optional browser checks use Python Playwright and Chromium. Install them
separately; they are not npm dependencies:

```bash
python -m pip install playwright
python -m playwright install chromium
```

Start the local demo in another terminal, then point the checks at its URL:

```bash
python tests/expert-form-browser.py http://localhost:3000
python tests/navigation-browser.py --base-url http://localhost:3000
python tests/home-browser.py http://localhost:3000
```

Replace the URL if the preview uses another port, such as `3087`. The expert
form checks cover validation, specialty selection, errors, retries, and
confirmation. Navigation checks cover keyboard use, focus, browser history,
and narrow screens. Homepage checks cover signup and background-video controls.

Submission responses are mocked in the browser; other write requests are
blocked. Keep those request guards in place when extending the checks. These
tests verify browser behavior without creating applications or signups, and
do not establish production persistence.

## What's here

| Page | What it does |
| --- | --- |
| `/` | Dataset examples, project approach, and contributor signup. |
| `/research` | A concise explanation of the proposed dataset formats and review approach. |
| `/community` | Example contributor work, specialties, and application questions. |
| `/apply` | Expert application. Posts to `/api/apply`; production storage uses Postgres. |
| `/admin` | Password-gated review queue. View, search, approve, reject, annotate. |
| `/benchmark` | "In progress" screen with an animated hourglass and a link home. |
| `/join` | Waitlist signup. Posts to `/api/waitlist`; persistence depends on the server mode. |

Blog pages have been removed from the public site.

### API

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /api/apply` | public | Submit an application |
| `POST /api/waitlist` | public | Join the waitlist |
| `GET /api/benchmark/leaderboard` | public | Read experimental aggregates; not used by the public benchmark page |
| `POST /api/admin/login` \| `logout` \| `GET session` | — | Admin session |
| `GET /api/admin/applications` | admin | The review queue |
| `POST /api/admin/decide` | admin | Approve / reject / annotate |
| `POST /api/benchmark/ingest` | admin | Register models, environments, runs, scorecards |

## The security model, in one paragraph

Every table has RLS enabled with **no** permissive policies, so the public
`anon` key can read and write nothing even if it leaks. All database access goes
through serverless functions holding the `service_role` key, which never leaves
the server. Admin auth is a shared password exchanged for an HMAC-signed,
`httpOnly` session cookie — page JavaScript cannot read it, and every admin
endpoint re-checks it server-side, so hiding a `<div>` is never what protects
the data. IP addresses are stored only as salted hashes.

If you ever add an RLS policy, re-run `npm run setup` with `SUPABASE_ANON_KEY`
also set: it will tell you if the public key can suddenly read applications.

## Experimental scoring backend

The schema accepts partial 0–10 scorecards associated with approved applicants.
An admin submits those records; that does not authenticate the reviewer or
prove that a build was played. The API requires three distinct panelists across
a model's runs, not per run or category. It does not establish independence.

The SQL rollup needs correction before use: joining scorecards and category
medians repeats medians, weights runs by their scorecard counts, inflates the
scorecard count, and overwrites duplicate category keys instead of computing
cross-run category means. The API and SQL remain experimental and unchanged.
Do not use these aggregates as benchmark evidence.

### Exercising scorecard ingestion

The following Bash examples illustrate the experimental API. They do not
validate the aggregate scoring method described above.

```bash
# Log in first (writes a cookie jar)
curl -c /tmp/c -X POST localhost:3000/api/admin/login \
  -H 'Content-Type: application/json' -d '{"password":"..."}'

# Register the model and the environment
curl -b /tmp/c -X POST localhost:3000/api/benchmark/ingest \
  -H 'Content-Type: application/json' \
  -d '{"action":"register-model","slug":"example-model-v1","name":"Example Model v1","vendor":"Example vendor"}'

curl -b /tmp/c -X POST localhost:3000/api/benchmark/ingest \
  -H 'Content-Type: application/json' \
  -d '{"action":"register-environment","slug":"tide-combat","name":"Tide: combat loop","spec":"Build a..."}'

# Open a run, score it, close it
curl -b /tmp/c -X POST localhost:3000/api/benchmark/ingest \
  -H 'Content-Type: application/json' \
  -d '{"action":"create-run","model":"example-model-v1","environment":"tide-combat","artifact_url":"https://..."}'

curl -b /tmp/c -X POST localhost:3000/api/benchmark/ingest \
  -H 'Content-Type: application/json' \
  -d '{"action":"record-score","run":"<run-id>","panelist_email":"jordan@studio.com",
       "ratings":{"game-mechanics":8,"level-design":7},"comment":"...","minutes_spent":40}'

curl -b /tmp/c -X POST localhost:3000/api/benchmark/ingest \
  -H 'Content-Type: application/json' -d '{"action":"finalize-run","run":"<run-id>"}'
```

## Deploying

Vercel picks up `api/*.js` automatically — no build step, no dependencies.
Set the four environment variables in **Vercel → Settings → Environment
Variables** (they are not read from `.env.local` in production).

Check the deployment account's current function limits and configuration
before publishing. Running the local preview does not deploy changes.
