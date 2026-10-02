# World Labs

Environments inside game engines for training and evaluating AI agents on long-horizon tasks, starting with Roblox Studio. The homepage emphasizes dependent work across code, 3D scenes, and live gameplay: planning, implementation, testing, and recovery. Static site plus a small serverless backend configured for Vercel.

## Current product status

The homepage introduces the environment, task, and verification direction alongside human-data projects across game engines and browser games, including WebGL experiences: expert demonstrations, critiques, comparisons, and revisions for game development, design, and playtesting. It uses a minimal, text-first layout. The environment, evaluation framework, and human-data projects are in development; this repository does not implement an RL gym, trajectory capture, dataset delivery, or a validated evaluation harness, and no benchmark results are published.

The application, waitlist, community, research, and admin pages remain available. Secondary pages retain the earlier expert-data positioning and have not yet been redesigned. The existing leaderboard API stores experimental aggregates and is not used by the homepage or public benchmark page.

The homepage uses `horizon.css`, without JavaScript. EB Garamond (wordmark) and Geist (body) are served locally from `assets/fonts`, alongside their open font licenses, with system fallbacks. Previous homepage scripts and styles remain in the repository. The older `tests/home-browser.py` checks target the previous interactive homepage and do not apply to this version.

See `docs/market-positioning-review-2026-09-08.md` for source-linked positioning,
implementation gaps, and the checks needed before publishing comparisons.
The [site quality pass](docs/site-quality-pass-2026-09-08.md) records the
readability, form, navigation, and browser checks completed for the local preview.

## Getting it running

Install Node.js 22 or later. Run `npm install` to install the database migration tool. The deployed API uses built-in Node.js features.
For a quick local preview without a database, run `npm run demo` and open
`http://localhost:3000`. Demo applications and signups stay in memory and are
lost when the server stops.

To connect the API to Supabase, put these four environment variables in
`.env.local` (gitignored — never commit it):

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...         # server-side secret key
ADMIN_PASSWORD=<pick a long one>          # gates /admin
SESSION_SECRET=<64 random hex chars>      # signs admin session cookies
```

Generate a session secret with:

```bash
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

Then:

```bash
npm run setup     # checks environment, table access, and optional public-key access
npm run dev       # http://localhost:3000
npm test          # automated tests, no network needed
```

In Windows PowerShell, use `npm.cmd` if the execution policy blocks `npm.ps1`.

### Applying the schema

Add the provider's `POSTGRES_URL` connection string to `.env.local`, then run
`npm run migrate:community`. This creates the private application and waitlist
tables and verifies their permissions. Alternatively, run `sql/community.sql`
in Supabase's SQL Editor. Neither method creates experimental benchmark tables.

See [community backend setup](docs/community-backend.md) for the deployment and
admin workflow. `SUPABASE_SERVICE_ROLE_KEY` remains supported for older projects.

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
python tests/admin-browser.py http://localhost:3000
```

Replace the URL if the preview uses another port, such as `3087`. The expert
form checks cover validation, specialty selection, errors, retries, and
confirmation. Navigation checks cover keyboard use, focus, browser history,
and narrow screens. Homepage checks cover signup and muted background-video autoplay.

Submission responses are mocked in the browser; other write requests are
blocked. Keep those request guards in place when extending the checks. These
tests verify browser behavior without creating applications or signups, and
do not establish production persistence.

## What's here

| Page | What it does |
| --- | --- |
| `/` | Long-horizon agent environments, the Roblox Studio starting point, human-data projects, and email contact. |
| `/research` | A concise explanation of the proposed dataset formats and review approach. |
| `/community` | Public expert community with specialty areas, application steps, expandable project examples, and FAQs. |
| `/handbook` | Contributor guide covering application review, project matching, assignments, and planned compensation practices. |
| `/apply` | Expert application. Posts to `/api/apply`; production storage uses Postgres. |
| `/admin` | Private application and waitlist inboxes with search, pagination, review statuses, and notes. |
| `/benchmark` | "In progress" screen with an animated hourglass and a link home. |
| `/join` | Waitlist signup. Posts to `/api/waitlist`; persistence depends on the server mode. |

Blog pages have been removed from the public site.

The community and handbook are public pages. Applying still submits to the private
admin inbox; it does not create a contributor account. Application confirmation
links to the handbook and community. Contributor login, a status dashboard, live
project listings, and project assignment workflows are not implemented yet.

### API

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /api/apply` | public | Submit an application |
| `POST /api/waitlist` | public | Join the waitlist |
| `GET /api/benchmark/leaderboard` | public | Read experimental aggregates; not used by the public benchmark page |
| `POST /api/admin/login` \| `logout` \| `GET session` | — | Admin session |
| `GET /api/admin/applications` | admin | Paginated application review queue and status counts |
| `GET /api/admin/waitlist` | admin | Paginated waitlist signups and submitted credits |
| `POST /api/admin/decide` | admin | Approve / reject / annotate |
| `POST /api/benchmark/ingest` | admin | Register models, environments, runs, scorecards |

## The security model, in one paragraph

The community schema enables RLS and revokes public and member access to both
submission tables. All database access goes
through serverless functions holding the Supabase secret key (or legacy `service_role` key), which never leaves
the server. Admin auth is a shared password exchanged for an HMAC-signed,
`httpOnly` session cookie — page JavaScript cannot read it, and every admin
endpoint re-checks it server-side, so hiding a `<div>` is never what protects
the data. IP addresses are stored only as salted hashes.

Run `npm run setup` with `SUPABASE_PUBLISHABLE_KEY` (or legacy `SUPABASE_ANON_KEY`)
to check that public reads are denied or return no rows. Empty tables alone do
not prove the permissions are correct; the migration also verifies table grants.

## Experimental scoring backend

The optional legacy schema in `sql/001_init.sql` accepts partial 0–10 scorecards associated with approved applicants.
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

Vercel picks up `api/*.js` automatically. The API needs no build step or runtime SDK.
Set the four environment variables in **Vercel → Settings → Environment
Variables** (they are not read from `.env.local` in production).

Check the deployment account's current function limits and configuration
before publishing. Running the local preview does not deploy changes.
