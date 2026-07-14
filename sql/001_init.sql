-- World Labs — initial schema
-- Run in Supabase → SQL Editor, or via `npm run migrate`.
--
-- SECURITY MODEL
-- Every table has RLS enabled with NO permissive policies. That means the
-- public `anon` key can read and write nothing, even if it leaks. All access
-- goes through serverless functions using the `service_role` key, which
-- bypasses RLS and never leaves the server.

create extension if not exists "pgcrypto";
-- citext: emails compare case-insensitively, so Foo@x.com and foo@x.com are
-- the same person and the unique index actually holds.
create extension if not exists "citext";

-- ============================================================
-- PANEL APPLICATIONS
-- ============================================================

do $$ begin
  create type application_status as enum ('pending', 'reviewing', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists applications (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  -- Identity
  full_name         text not null,
  email             citext not null,
  country           text,
  linkedin_url      text,
  portfolio_url     text,
  github_url        text,

  -- Craft. specialties is ranked: index 0 is their primary.
  specialties       text[] not null default '{}',
  years_experience  int,
  shipped_credits   text not null,
  video_url         text,

  -- Availability
  hours_per_week    int,
  hourly_rate_usd   numeric(10,2),

  -- Context
  heard_from        text,
  notes             text,

  -- Review state
  status            application_status not null default 'pending',
  admin_notes       text,
  reviewed_at       timestamptz,
  reviewed_by       text,

  -- Abuse forensics. ip_hash is a salted hash, never a raw IP.
  ip_hash           text,
  user_agent        text
);

-- One application per person. Re-submitting updates rather than duplicating.
create unique index if not exists applications_email_key on applications (email);
create index if not exists applications_status_created_idx on applications (status, created_at desc);

-- ============================================================
-- LIGHTWEIGHT WAITLIST (join.html)
-- ============================================================

create table if not exists waitlist (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  email       citext not null,
  specialty   text,
  credits     text,
  ip_hash     text,
  converted_to_application uuid references applications(id) on delete set null
);

create unique index if not exists waitlist_email_key on waitlist (email);

-- ============================================================
-- BENCHMARK
-- ============================================================
-- A `run` is one model's attempt at one task inside an instrumented game
-- environment. Panelists (approved applicants) score each run against the
-- 14-category taxonomy published on /research. A run's score is the median
-- panelist score per category; a model's leaderboard score is the mean across
-- its runs, and is only shown once it clears a quorum of independent scores.

-- The 14 categories from research.html. Seeded below.
create table if not exists eval_categories (
  id          smallint primary key,
  slug        text not null unique,
  name        text not null,
  question    text not null,
  sort_order  smallint not null
);

create table if not exists environments (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  slug         text not null unique,
  name         text not null,
  description  text,
  genre        text,
  -- The prompt/spec handed to the model.
  spec         text,
  version      text not null default 'v1',
  is_published boolean not null default false
);

create table if not exists models (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  slug        text not null unique,
  name        text not null,
  vendor      text,
  version     text
);

do $$ begin
  create type run_status as enum ('queued', 'running', 'complete', 'failed', 'scoring', 'scored');
exception when duplicate_object then null; end $$;

create table if not exists runs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  model_id        uuid not null references models(id) on delete cascade,
  environment_id  uuid not null references environments(id) on delete cascade,
  status          run_status not null default 'queued',
  -- Where the produced artifact lives (build, repo, replay).
  artifact_url    text,
  -- Free-form harness output: token counts, wall time, errors.
  telemetry       jsonb not null default '{}'::jsonb,
  completed_at    timestamptz
);

create index if not exists runs_model_env_idx on runs (model_id, environment_id);
create index if not exists runs_status_idx on runs (status);

-- One panelist's scorecard for one run.
create table if not exists scores (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  run_id        uuid not null references runs(id) on delete cascade,
  panelist_id   uuid not null references applications(id) on delete cascade,
  -- { "<category_slug>": 0..10 }. Partial scorecards are allowed; a panelist
  -- may only be qualified to judge some categories.
  ratings       jsonb not null default '{}'::jsonb,
  comment       text,
  -- Minutes spent. Used for panelist payout and for weeding out rubber-stamps.
  minutes_spent int
);

-- A panelist scores a given run at most once.
create unique index if not exists scores_run_panelist_key on scores (run_id, panelist_id);

-- ============================================================
-- LEADERBOARD
-- ============================================================
-- Deliberately a view, not a table: scores are the source of truth and the
-- board is always derived. There is no way to write a leaderboard number that
-- isn't backed by real panelist scorecards.

create or replace view run_scores as
select
  s.run_id,
  cat.key                                as category_slug,
  count(*)                               as n_panelists,
  percentile_cont(0.5) within group (order by (cat.value)::numeric) as median_score
from scores s
cross join lateral jsonb_each_text(s.ratings) as cat(key, value)
where cat.value ~ '^[0-9]+(\.[0-9]+)?$'
group by s.run_id, cat.key;

create or replace view leaderboard as
select
  m.id                                as model_id,
  m.slug                              as model_slug,
  m.name                              as model_name,
  m.vendor,
  count(distinct r.id)                as n_runs,
  count(distinct s.panelist_id)       as n_panelists,
  count(s.id)                         as n_scorecards,
  round(avg(rs.median_score), 2)      as overall_score,
  jsonb_object_agg(
    rs.category_slug,
    round(rs.median_score, 2)
  ) filter (where rs.category_slug is not null) as category_scores,
  max(r.completed_at)                 as last_run_at
from models m
join runs r        on r.model_id = m.id and r.status = 'scored'
join scores s      on s.run_id = r.id
join run_scores rs on rs.run_id = r.id
group by m.id, m.slug, m.name, m.vendor;

-- ============================================================
-- SEED: the 14 eval categories from /research
-- ============================================================

insert into eval_categories (id, slug, name, question, sort_order) values
  (1,  'game-mechanics',    'Game Mechanics',            'Did the model build the mechanic the prompt asked for?', 1),
  (2,  'spec-adherence',    'Spec Adherence',            'Does the whole artifact match the prompt?',              2),
  (3,  'iteration-accuracy','Iteration Accuracy',        'When you prompt a change, does exactly that change?',    3),
  (4,  'level-design',      'Level Design',              'Is the generated environment well designed?',            4),
  (5,  'balance',           'Balance',                   'Are the generated systems balanced?',                    5),
  (6,  'narrative',         'Narrative',                 'Does the generated story work?',                         6),
  (7,  'player-experience', 'Player Experience',         'Will players enjoy this?',                               7),
  (8,  'ux-onboarding',     'UX / Onboarding',           'Can a new player figure it out?',                        8),
  (9,  'ai-npc',            'AI NPC / Agent Interaction','Do the agents behave believably?',                       9),
  (10, 'generated-content', 'Generated Content',         'Is the generated content any good?',                     10),
  (11, 'code-technical',    'Code / Technical',          'Is what it built actually sound?',                       11),
  (12, 'qa-stability',      'QA / Stability',            'Does it hold up under play?',                            12),
  (13, 'game-economy',      'Game Economy',              'Does the economy hold together?',                        13),
  (14, 'human-preferences', 'Human Preferences',         'Which build do people actually prefer?',                 14)
on conflict (id) do update
  set slug = excluded.slug,
      name = excluded.name,
      question = excluded.question,
      sort_order = excluded.sort_order;

-- ============================================================
-- LOCK EVERYTHING DOWN
-- ============================================================
-- RLS on, zero policies. The anon/public key can touch nothing. Only
-- service_role (server-side) gets through.

alter table applications    enable row level security;
alter table waitlist        enable row level security;
alter table eval_categories enable row level security;
alter table environments    enable row level security;
alter table models          enable row level security;
alter table runs            enable row level security;
alter table scores          enable row level security;

revoke all on applications, waitlist, eval_categories, environments, models, runs, scores from anon, authenticated;
revoke all on leaderboard, run_scores from anon, authenticated;
