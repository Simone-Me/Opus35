# Opus35

Opus35 is a classical music catalog and personal listening journal.

It combines:

- A public catalog of composers and works
- Per-user tagging and notes for works
- Per-user personal notes in profile (up to 500 characters each)
- Profile and stats views built from user logs
- Lazy biography enrichment from Wikipedia

## Stack

- Frontend: React + Vite
- Routing: React Router
- Backend/Auth/Database: Supabase
- Charts: Recharts
- Seed source: OpenOpus API
- Lazy enrichment source: Wikipedia REST API
- Hosting: Netlify

## Update policy (required)

For each product change (UI, behavior, data model, security, migrations, or deployment):

- Update this file (`README.md`) in the same change.
- Add one new entry to `news/README_n1.md` with what changed and why.
- Keep route behavior and feature bullets aligned with real app behavior.
- If a field or UX flow is removed, remove or adjust related documentation immediately.

## App functionality

### Route map

- `/browse`: Composer catalog with search + epoch filter
- `/composer/:composerId`: Composer profile, biography, works, user categories
- `/zibaldone`: Flat index of all works with search/filter/sort/pagination
- `/profile`: User log entries by tab/category, edit and delete
- `/stats`: User analytics from heard logs
- `/auth`: Email/password auth (login, signup, reset, signout)

Main menu labels in UI:

- `Composers`, `Zibaldone`, `Profile`, `Discover`
- Logged-in state shows `Logout` with double-click confirmation (instead of an `Auth` menu item)

### Page behavior

#### Browse

- Loads all composers sorted by name
- Search by composer name
- Filter by epoch chip
- Displays empty state when nothing matches
- Empty-search state asks users to verify search text and suggests missing artists via footer contact area
- Each card links to composer detail page (arrow button)

#### Composer

- Loads composer details, all works for the selected composer, and only the signed-in user's logs for those works
- Navigating to another composer resets filters, tabs and pending requests (the view is keyed by composer id)
- Uses `complete_name` as the main heading when available
- Work list supports search, genre filter, and pagination
- Work list includes a multi-select action filter (`Show all`, `Attended`, `Favorite`, `Record`, `Alert`)
- Each work row shows publication date (`TBD` when missing)
- Per-work category actions are toggled via `streamline-ultimate:music-on-off-1` icon:
  - icon click opens/closes the action controls with a smooth slide animation
  - action controls include text + icon and use hover help text
  - selected categories remain visible as chips even when controls are collapsed
  - flag toggles are atomic database calls; the work's buttons are disabled while a toggle is in flight, and the UI is updated from the returned row (no full reload)
- Available categories:
  - `heard` (labeled `Attended`, with details modal)
  - `favorite` (flag)
  - `record` (stored as `bought` category key, with details modal)
  - `alert` (flag)
- Includes a `Notes` tab for private per-composer notes (owner-only, max 500 chars)
- Attended details include extended vocal data entry:
  - choir/solo mini-grid with multiple lines
  - vocal role selector (`Choir`, `Solo`, `Tenor`, etc.)
  - vocalist/group name input (max 140 chars)
- Attended/Record place supports selectable defaults and custom typed entries (suggestions come from all places the user already typed)
- The details modal closes with `Escape`, is labelled for screen readers, and always reopens with the saved values (unsaved edits are discarded on cancel)
- If biography is missing, lazily invokes Edge Function to fetch Wikipedia summary
- Biography preview is intentionally short for readability
- Composer header includes a quick `here` link that jumps to footer contact for missing-artist suggestions
- Composer not-found state directs users to the footer contact area to suggest missing artists

#### Zibaldone

- Reads one page at a time from the `works_index` view: search, filters, sort and pagination run in the database (no full catalog download)
- Search is debounced (300 ms) and user input is escaped before reaching the PostgREST filter
- Includes one daily random recommendation per signed-in user, picked by the `generate_daily_recommendation` RPC
- Reuses the same recommendation until local midnight (the day is the visitor's local calendar day)
- Avoids repeating works already recommended during the previous 365 days
- Search by work title or composer name
- Filters by epoch and genre
- Sort by title/composer/epoch/genre
- Pagination with configurable page size

#### Profile

- Shows user logs expanded by category
- Tabs: `All`, `Attended`, `Favorites`, `Records`, `Alerts`, `Notes`
- Category column and details preview use readable labels (e.g. `Attended`, `Opera de Paris · Accentus`)
- For detailed categories (`heard`, `bought`), supports editing category-specific fields
- Supports category deletion per work
- Includes personal notes in dedicated `Notes` tab:
  - Add note (max 500 chars)
  - Delete note
  - Full chronological list of saved notes

#### Stats

- Uses only logs tagged as `heard` (labelled `Attended`)
- Chart 1: composers with most attended works (one log per work, so a work attended twice counts once)
- Top-composer chart uses angled x-axis labels so long names stay readable
- Tooltip styling uses dark theme colors for readability
- Chart 2: attended works by year with full epoch buckets (`Medieval`, `Renaissance`, `Baroque`, `Classical`, `Early Romantic`, `Late Romantic`, `Romantic`, `20th Century`, `Post-War`, `21st Century`, `Other`)
- Epoch-by-year chart includes visible legend and distinct color per epoch bucket
- Epoch tooltip shows only present values (non-zero buckets), with opaque styling for readability
- The Discover page and Recharts are loaded on demand (separate chunk)

#### Favicons

- Website favicon assets are served from `public/` (`favicon.ico`, PNG sizes, Apple touch icon)
- `index.html` includes favicon and `site.webmanifest` links, a meta description and theme color
- Google Fonts are loaded from `index.html` with `preconnect` (not a CSS `@import`)

#### Auth

- Login with email/password
- Signup with password policy:
  - minimum 12 chars
  - at least 1 special character
  - confirm password must match
- Password policy is checked in the client; set the same rules in Supabase (Authentication → Policies/Providers → Email: minimum length 12 and required characters) so it cannot be bypassed through the API
- Password reset:
  - `Reset password` sends an email whose link returns to `/auth?mode=recovery`
  - the app listens for the `PASSWORD_RECOVERY` auth event and shows a `New password` form (`supabase.auth.updateUser`)
  - add `https://<your-domain>/auth?mode=recovery` (and `http://localhost:5173/auth?mode=recovery` for development) to Supabase → Authentication → URL Configuration → Redirect URLs
- Buttons are disabled while an auth request is in flight (no double submit)
- Sign out

#### Runtime safety

- Global error boundary catches render/runtime crashes and shows fallback UI
- Unknown routes render a not-found page

#### Contact and suggestions

- Footer uses a classic multi-column layout (`Contact`, `Navigation`, `Sources`, `About`)
- Footer includes a bottom utility bar with quick links and copyright
- Contact section shows a plain contact sentence and direct email display with copy-to-clipboard button (no mailto in footer contact)
- Contact links use `VITE_CONTACT_EMAIL` and fallback to `contact@opus35.fr`

## Data lifecycle

### 1) Catalog ingestion (one-time or repeatable)

Script: `scripts/seed-openopus.mjs`

- Fetches recommended composers from OpenOpus
- Upserts into `public.composers`
- For each composer, fetches all works and upserts into `public.works`
- Uses chunked upserts for large payloads
- Attempts to infer `publication_year` from work title/subtitle text when available
- If a single composer work fetch fails, the script logs warning and continues

### 2) Runtime catalog reads

Service: `src/services/catalogService.js`

- `getComposerCatalog()` for Browse (only `id,name,complete_name,epoch`)
- `getComposerById()` and `getWorksByComposerId()` for Composer page
- `getWorksPage()` and `getWorkFilterOptions()` for Zibaldone (views `works_index`, `composer_epochs`, `work_genres`)

### 3) User-generated data

Service: `src/services/logService.js`

- One row per `(user_id, work_id)` in `user_logs`
- Multiple categories stored in `categories text[]`
- Per-category metadata stored in `details jsonb` under keys like `details.heard` and `details.bought`
- All writes go through SQL functions (RPC) that run as the caller (`security invoker`, RLS applies) and use `auth.uid()`:
  - `set_user_log_category(p_work_id, p_category, p_details)`: adds a category; non-empty details replace `details[category]`
  - `remove_user_log_category(p_work_id, p_category)`: removes category + details, deletes the row when no category remains
  - `toggle_user_log_category(p_work_id, p_category)`: flips a flag under a row lock
- Each RPC is a single transaction, so double clicks or two open tabs cannot lose categories (the previous read-modify-write in the browser could)
- RPCs return the resulting row (or nothing when deleted); pages apply it locally instead of reloading every log
- `details` must be a JSON object of at most 16 KB (`user_logs_details_shape` check)

### 4) Personal notes

Service: `src/services/noteService.js`

- Per-user profile notes are stored in `profile_notes`
- Max note length is 500 characters (validated in client via `src/lib/notes.js` and in DB)
- Notes are listed in profile, ordered by `updated_at` descending

### 5) Lazy enrichment (biography)

Supabase Edge Function: `supabase/functions/wikipedia-enrichment/index.ts`

- Triggered by Composer page when `composer.bio` is empty (once per page view); the response already contains the updated composer
- Looks up composer in DB
- Throttled per composer: `composers.enrichment_attempted_at` is claimed atomically, so Wikipedia is queried at most once per composer every 7 days, whoever calls the function
- Never overwrites an existing bio, except with `force: true` plus the `x-enrichment-admin-secret` header matching `ENRICHMENT_ADMIN_SECRET`
- Only browsers on `ALLOWED_ORIGINS` get CORS access; errors are logged server-side and returned as a generic message
- Queries Wikipedia summary endpoint using normalized `First_Last` and full-name title candidates
- Falls back to MediaWiki search API when direct summary-title resolution fails
- Updates composer row with:
  - full `bio` extract (not truncated)
  - `wikipedia_url`
  - `portrait_url` only if portrait is currently missing
- Keeps enrichment non-blocking for UI even when no summary is found

### 6) Composition date enrichment roadmap

- OpenOpus does not always include complete publication/composition dates.
- Recommended enrichment strategy for future implementation:
  - Search list pages like `List_of_compositions_by_First_Last`.
  - Parse year/title pairs from Wikipedia list tables.
  - Match against `works.title` with conservative title normalization.
  - Only write `publication_year` when confidence is high.

### 7) Dry-run proposal script for composition years

Script: `scripts/propose-wikipedia-work-dates.mjs`

- Generates a JSON report with proposed `publication_year` values.
- Reads only works where `publication_year` is currently null.
- Uses Wikipedia list pages (`List_of_compositions_by_*`) and conservative score matching.
- Dry-run only: no database writes are executed.
- Reads config from `.env`/`.env.local` when present.
- Can run with either `SUPABASE_SERVICE_ROLE_KEY` or `VITE_SUPABASE_ANON_KEY` (read-only mode).

Run:

```bash
npm run dates:propose
```

Optional:

- `npm run dates:propose -- --composer=Tchaikovsky`
- `npm run dates:propose -- --min-score=0.75`
- `npm run dates:propose -- --out=news/date-proposals-custom.json`
- `npm run dates:propose -- --url=https://... --key=...`

### 8) Composer biography backfill utility

Script: `scripts/enrich-composer-bios.mjs`

- Fetches missing composer bios from Wikipedia summary endpoint.
- Uses title variants and search fallback for better match rates.
- Writes `bio`, `wikipedia_url`, and missing `portrait_url` into `composers`.
- Does not truncate biography text before writing.

Run:

```bash
npm run bios:enrich
```

Optional:

- `npm run bios:enrich -- --composer=Tchaikovsky`
- `npm run bios:enrich -- --limit=20`

## Database storage model

Schema: `supabase/schema.sql`

### `public.composers`

- Source of truth for composer metadata
- Key fields: `openopus_id`, `name`, `complete_name`, `epoch`, `birth`, `death`, `bio`, `wikipedia_url`, `portrait_url`
- `enrichment_attempted_at`: last Wikipedia lookup (throttle for the Edge Function)

### `public.works`

- Works linked to composers via `composer_id`
- Key fields: `openopus_id`, `title`, `genre`, `publication_year`, `popularity`

### `public.profiles`

- 1:1 with `auth.users`
- Created automatically by trigger `handle_new_user()`
- Key fields: `display_name`, `created_at`, `updated_at`

### `public.user_logs`

- Per-user tracking of works
- Unique key: `(user_id, work_id)`
- `categories text[]` with allowed values enforced by CHECK constraint:
  - `heard`, `favorite`, `bought`, `alert`
- `details jsonb` for category-specific payloads
- `updated_at` maintained by trigger

### `public.profile_notes`

- Per-user personal notes shown in Profile
- Key fields: `user_id`, `note`, `created_at`, `updated_at`
- DB constraint enforces note length from 1 to 500 characters

### `public.composer_notes`

- One private note per `(user_id, composer_id)`
- Key fields: `user_id`, `composer_id`, `note`, `created_at`, `updated_at`
- DB constraint enforces note length from 1 to 500 characters

### `public.daily_recommendations`

- Stores one generated recommendation per `(user_id, recommendation_date)`
- Key fields: `user_id`, `work_id`, `recommendation_date`, `created_at`
- Used by Zibaldone daily random recommendation and 365-day non-repeat behavior

### Indexing and search

- GIN index for full-text title search on `works` (`to_tsvector('simple', title)`)
- GIN index on `user_logs.categories`
- Additional btree indexes for common joins/filters and Zibaldone sorting (`works.title`, `works.genre`, `composers.name`, `composers.epoch`)

### Read views and RPCs

- `works_index` (works + composer name/epoch), `composer_epochs`, `work_genres`: `security_invoker` views, so the catalog RLS still applies
- `set_user_log_category`, `remove_user_log_category`, `toggle_user_log_category`, `generate_daily_recommendation`: executable by `authenticated` only (revoked from `anon`)

## Missing data and failure behavior

### Missing Supabase credentials

When `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing:

- App shell shows environment warning banner
- Catalog services return empty data (`[]` or `null`)
- Browse shows zero composers
- Composer page shows setup hint instead of attempting DB calls
- Auth actions are disabled and warning is shown

### Missing catalog fields

UI fallbacks:

- Missing composer epoch: `Unknown period` / `Unknown epoch`
- Missing portrait: `No portrait` placeholder
- Missing work genre: `genre n/a` or `Unknown`
- Missing composer link in Zibaldone: shows `n/a` instead of button

### Missing biography

- Composer page displays: `No biography yet. Visit again to trigger lazy enrichment.`
- Enrichment is attempted once per page view when `bio` is empty; the function itself retries a composer at most once every 7 days
- If function cannot enrich (for example no Wikipedia summary), composer remains unchanged and UI keeps fallback text
- Successful enrichment stores and shows a short biography preview

### Edge Function failures

If enrichment call fails (network, deploy, auth mode mismatch, missing env vars), the page keeps working and shows a low-noise informational message in biography section instead of a blocking red error alert.

Example visible message:

- `Biography enrichment is temporarily unavailable. You can continue browsing works.`

### Auth-dependent pages

- Profile and Stats require signed-in user context
- Without sign-in, pages render guidance instead of private data

## Security model (RLS)

Defined in `supabase/schema.sql`, validated automatically by `supabase/tests/rls_test.sql` (see Tests).

- Public read access: `composers`, `works`
- Owner-only access: `profiles`, `user_logs`, `profile_notes` (select/insert/update/delete)
- Owner-only access: `composer_notes`, `daily_recommendations` (select/insert/update/delete as needed)
- Insert/update checks enforce `auth.uid()` ownership
- Nobody but the service role can write `composers`/`works`

### HTTP security headers (Netlify)

`netlify.toml` sets on every page: a Content-Security-Policy (scripts from the site only; API calls only to `*.supabase.co`; fonts from Google Fonts; images from any https source for Wikimedia/OpenOpus portraits), `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and HSTS. Hashed files under `/assets/*` are cached for one year (`immutable`).

If you add a new external origin (analytics, another API, a custom Supabase domain), extend the CSP accordingly.

## Setup and run

### 1) Install

```bash
npm install
```

### 2) Configure environment

Create `.env` from `.env.example` and set real values.

Required frontend/runtime values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Required values for seed and Edge Function deployment/runtime:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 3) Initialize database

Run `supabase/schema.sql` in Supabase SQL editor.

`schema.sql` is idempotent (safe to run again) and always matches the result of all migrations.

If upgrading an existing project, run the migrations you have not applied yet, in order:

- `supabase/migrations/20260407_phase3_phase4.sql`
- `supabase/migrations/20260409_profile_notes.sql`
- `supabase/migrations/202604100001_composer_notes_daily_recommendations.sql`
- `supabase/migrations/202610050001_hardening_rpc_views.sql` (RPCs, views, details guard, enrichment throttle; required by the current frontend)

### 4) Seed catalog

```bash
npm run seed
```

### 5) Deploy enrichment function

Set the function secrets, then deploy:

```bash
supabase secrets set ALLOWED_ORIGINS="https://<your-domain>,http://localhost:5173"
# optional, only needed to force re-enrichment of an existing bio
supabase secrets set ENRICHMENT_ADMIN_SECRET="<long random string>"
supabase functions deploy wikipedia-enrichment
```

JWT verification stays on by default: requests need the project's anon key (legacy `eyJ...` JWT) or a user token, which `supabase.functions.invoke` sends automatically. If the project uses the new non-JWT publishable keys (`sb_publishable_...`), deploy with `--no-verify-jwt`: the per-composer throttle, the origin allow-list and the admin-only `force` keep the function safe to expose.

### 6) Start frontend

```bash
npm run dev
```

## Build and deployment

### Local build

```bash
npm run build
```

### Netlify

Configured in `netlify.toml`:

- build command: `npm run build`
- publish dir: `dist`
- SPA redirect: `/* -> /index.html`

Set Netlify env vars:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### GitHub Actions: Supabase keep-alive and backup

Two scheduled workflows keep the Supabase Free-tier project alive and back up its data, since Supabase Free pauses projects after a week of inactivity and does not retain any backups itself.

- `.github/workflows/keepalive.yml`: pings the project's REST endpoint every night at 02:00 UTC (also runnable manually via `workflow_dispatch`).
- `.github/workflows/backup.yml`: dumps the full database every Sunday at 03:11 UTC, checks it (size + gzip integrity) **before** uploading, encrypts it with GPG (AES256) when `BACKUP_PASSPHRASE` is set, and uploads it as a workflow artifact (30-day retention, also runnable manually via `workflow_dispatch`). The dump includes the `auth` schema (emails and password hashes), hence the encryption. Restore with `gpg --decrypt <file>.sql.gz.gpg | gunzip | psql "<connection string>"`.

Required GitHub repo configuration (Settings → Secrets and variables → Actions):

Variables tab (same names as used elsewhere in this project, see `.env.example`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Secrets tab:

- `SUPABASE_DB_URL`: connection pooler string (Session or Transaction pooler, not the direct `db.<ref>.supabase.co` host, which is IPv6-only and unreachable from GitHub-hosted runners), found in Supabase dashboard → Project Settings → Database → Connection string. Format:

  ```text
  postgresql://postgres.<project-ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
  ```

- `BACKUP_PASSPHRASE`: passphrase used to encrypt the backup (keep a copy outside GitHub, otherwise the backups cannot be decrypted). Without it the workflow still runs but uploads the dump unencrypted and shows a warning.

## Tests and CI

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request:

| Job | Command | What it checks |
| --- | --- | --- |
| Lint, test and build | `npm run lint`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high` | ESLint, Vitest unit/component tests (`src/**/*.test.js(x)`), production build, vulnerable dependencies |
| Schema, RLS and RPC tests | `bash scripts/test-db.sh` | On a disposable Postgres with a Supabase stub (`supabase/tests/supabase_stub.sql`): `schema.sql` twice (idempotency), all migrations replayed, the production upgrade path, a diff proving `schema.sql` equals the migrated schema, and `supabase/tests/rls_test.sql` (RLS isolation between users, anon restrictions, RPC behaviour, recommendation rules) |
| Edge Function tests | `deno fmt --check`, `deno lint`, `deno check`, `deno test` | `supabase/functions/wikipedia-enrichment/handler.test.ts` (throttle, admin-only force, CORS, input validation, no error leaks) |

Run locally:

```bash
npm test                    # frontend
npm run test:functions      # needs Deno
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run test:db   # needs a throwaway Postgres
```

Never point `test:db` at the real Supabase project: it creates and drops a test database and inserts fixture users.

## Key folders

```text
src/
	components/      UI shell, modal, pagination, error boundary
	hooks/           shared React hooks (category modal state, debounce)
	lib/             shared constants/helpers (categories, notes, password, epochs) + Supabase client
	pages/           route pages (lazy-loaded)
	services/        data access and mutation logic
	test/            test setup and helpers
supabase/
	schema.sql       full schema + RLS + triggers + RPCs + views (idempotent)
	migrations/      incremental schema changes
	tests/           Supabase stub + RLS/RPC test-suite
	functions/
		wikipedia-enrichment/   index.ts (entry), handler.ts, wikipedia.ts, handler.test.ts
scripts/
	seed-openopus.mjs
	test-db.sh       SQL test runner (local/CI)
```
