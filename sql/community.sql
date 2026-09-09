-- Community storage only. Safe to apply repeatedly.
BEGIN;
SET LOCAL search_path = public, extensions;
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


-- Only server-side authenticated APIs may read or write submissions.
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.applications, public.waitlist FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications, public.waitlist TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
