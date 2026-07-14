# World Labs

RL environments and expert evals for AI in games. Static site plus a small
serverless backend, deployed on Vercel.

## Getting it running

You need three secrets. Put them in `.env.local` (gitignored — never commit it):

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
npm test          # 58 tests, no network needed
```

**Node isn't on your PATH.** It's installed at `~/.local/node`. Either add
`export PATH="$HOME/.local/node/bin:$PATH"` to your `~/.zshrc`, or prefix
commands with it.

### Applying the schema

Supabase's REST API can't run DDL, so this is a copy-paste, once:

> Supabase → SQL Editor → New query → paste all of `sql/001_init.sql` → Run.

`npm run setup` will tell you if you haven't.

### Trying it without Supabase

```bash
npm run demo      # in-memory database, admin password "demo"
```

Everything works end to end; nothing persists past the process. Useful for
clicking through the flow without touching a real database.

## What's here

| Page | What it does |
| --- | --- |
| `/apply` | The real panel application. Posts to `/api/apply`, stored in Postgres. |
| `/admin` | Password-gated review queue. View, search, approve, reject, annotate. |
| `/benchmark` | Public leaderboard, computed from real panelist scorecards. |
| `/join` | Lightweight waitlist. Also real now — it used to fake success and discard the email. |

### API

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /api/apply` | public | Submit an application |
| `POST /api/waitlist` | public | Join the waitlist |
| `GET /api/benchmark/leaderboard` | public | Read the board |
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

## How a benchmark score is made

A model is given an environment spec and builds inside an instrumented game
world. Approved panelists play the resulting artifact and score it 0–10 across
the 14 categories published on `/research`. Partial scorecards are expected —
a panelist scores only what they're qualified to judge.

Aggregation is deliberately conservative:

- A run's score per category is the **median** across panelists, so one outlier
  can't swing it.
- A model's score is the mean across its scored runs.
- A model is **not ranked** until at least **3 independent panelists** have
  scored its runs. Below that it's held as provisional.
- `leaderboard` is a SQL **view**, not a table. There is no row to hand-edit —
  the only way to move a number is to record a real scorecard from an approved
  panelist. `/api/benchmark/ingest` enforces that: a pending applicant, a
  rejected applicant, and a stranger are all refused.

The board currently shows an honest empty state, because no runs have been
scored yet. That's correct. It fills in the moment real scorecards land.

### Recording a real result

```bash
# Log in first (writes a cookie jar)
curl -c /tmp/c -X POST localhost:3000/api/admin/login \
  -H 'Content-Type: application/json' -d '{"password":"..."}'

# Register the model and the environment
curl -b /tmp/c -X POST localhost:3000/api/benchmark/ingest \
  -H 'Content-Type: application/json' \
  -d '{"action":"register-model","slug":"claude-opus-4-8","name":"Claude Opus 4.8","vendor":"Anthropic"}'

curl -b /tmp/c -X POST localhost:3000/api/benchmark/ingest \
  -H 'Content-Type: application/json' \
  -d '{"action":"register-environment","slug":"tide-combat","name":"Tide: combat loop","spec":"Build a..."}'

# Open a run, score it, close it
curl -b /tmp/c -X POST localhost:3000/api/benchmark/ingest \
  -H 'Content-Type: application/json' \
  -d '{"action":"create-run","model":"claude-opus-4-8","environment":"tide-combat","artifact_url":"https://..."}'

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

Nine serverless functions total; the Hobby tier allows twelve.
