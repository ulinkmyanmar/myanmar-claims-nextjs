# Myanmar Claims History Checking System

Next.js production scaffold for a secure internal historical claims checking platform for Ulink Myanmar.

## Recommended stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- Supabase Storage for upload files
- n8n for Slim Claims File refresh automation

## Current scaffold includes

- Login page
- Dashboard
- Individual member search page
- Search API route with demo matching logic
- Bulk census checking page scaffold
- Historical database management page scaffold
- Audit logs page scaffold
- Matching normalization utilities
- Supabase client helper
- Supabase SQL schema with RLS policies
- n8n workflow design notes

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

The sandbox used to generate this project may not have internet access. Run `npm install` on your own machine or deployment environment.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor (this also creates a trigger
   that auto-provisions a `profiles` row for every new Auth user).
3. Add environment variables to `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only secret — never expose to the browser)
4. Create the initial admin account:
   ```bash
   node --env-file=.env.local scripts/create-admin-user.mjs you@ulink-assist.com "a-strong-password" "Your Name"
   ```
   This creates the Supabase Auth user and marks its `profiles` row as
   `role='admin', active=true`. Run it again with a different email to add
   more admins.

## Login / authentication

- `/login` posts credentials to `app/api/auth/login/route.ts`, which calls
  Supabase Auth's `signInWithPassword` **on the server**. That is the actual
  username/password check — the browser never decides whether a password is
  correct.
- A login only succeeds if (a) the password matches Supabase's stored hash
  **and** (b) the corresponding `profiles` row exists with `active = true`.
  Deactivating a user (set `active = false`) revokes access immediately.
- `middleware.ts` re-checks the session on every request and redirects
  signed-out users to `/login`, and signed-in users away from `/login`.
- `Database Management` and `Audit Logs` are only shown/usable for
  `role = 'admin'` profiles (enforced both in the nav and by the RLS
  policies in `supabase/schema.sql`).
- Log out via the button in the top bar, which calls
  `app/api/auth/logout/route.ts`.

## Production notes

- Keep the Slim Claims Excel file as an import/source file only.
- Do not expose raw database tables directly to end users.
- All searches, uploads, and database refreshes should write audit logs.
- Uploaded census files contain personal data; define retention before production.
