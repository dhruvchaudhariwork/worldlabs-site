# Community submissions and admin inbox

The public application posts to `/api/apply`; the home and community waitlists post to `/api/waitlist`. Confirmed submissions are stored in Supabase Postgres. `/admin` provides a password-protected inbox for both kinds of submission.

## Reviewing submissions

Open `/admin` and sign in with the configured admin password. Applications appear under Pending. Select an applicant to see their credits, ranked specialties, availability, contact links, and optional notes. You can mark them Reviewing, Approved, or Rejected and save private review notes. Status changes are internal; they do not send messages to applicants.

The Waitlist tab shows signup emails, specialties, and submitted credits. Search works in either inbox. Pagination makes every matching submission accessible. Refresh fetches current database contents; unsaved notes remain in the current browser tab until saved or discarded.

The server verifies the signed, HttpOnly session cookie before returning applicant data or accepting review changes. The SQL schema denies direct public reads and writes. Neither the Supabase secret nor the admin password is embedded in browser code.

## Production setup

1. Create or connect a Supabase project in the existing Vercel project's Storage/Integrations area. The native integration supplies `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `POSTGRES_URL`. Legacy service-role keys remain supported.
2. Configure `ADMIN_PASSWORD` and `SESSION_SECRET` as sensitive Production environment variables. Use a unique admin password and a random signing secret of at least 32 characters.
3. Pull the database variables into a gitignored environment file. Sensitive admin values may not be returned by Vercel; provide them locally when running the configuration check.
4. Run the community-only migration. It creates the application and waitlist tables without creating experimental benchmark tables or deleting existing submissions.
5. Deploy to Production after configuring the variables, then verify a submission through the public form and the authenticated inbox.

```powershell
npm.cmd install
vercel.cmd env pull .env.local --environment production
npm.cmd run migrate:community
npm.cmd run setup
```

To select another environment file, pass `-- --env-file=.env.production.local` to either npm command. The migration verifies TLS certificates; a provider-specific CA may be supplied with `POSTGRES_CA_CERT` if required.

`sql/community.sql` is idempotent. It enables row security, revokes public/member table access, grants the server role access, and asks PostgREST to reload its schema. The migration then verifies those permissions. Credentials belong in Vercel or gitignored local files, never source control.

## Verification and local preview

`npm test` covers persistence, access control, review updates, waitlist handling, exact counts, pagination, and safe search construction. `python tests/admin-browser.py http://localhost:3090` covers the admin interface with mocked API responses and blocked writes. The public-form browser checks are documented in the README.

`npm run demo` uses an in-memory substitute. It is suitable for local UI work, but restarting it clears its submissions. Production must use the actual Supabase project.
