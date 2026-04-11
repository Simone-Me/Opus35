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

- Loads composer details and all works for the selected composer
- Uses `complete_name` as the main heading when available
- Work list supports search, genre filter, and pagination
- Work list includes a multi-select action filter (`Show all`, `Attended`, `Favorite`, `Record`, `Alert`)
- Each work row shows publication date (`TBD` when missing)
- Per-work category actions are toggled via `streamline-ultimate:music-on-off-1` icon:
  - icon click opens/closes the action controls with a smooth slide animation
  - action controls include text + icon and use hover help text
  - selected categories remain visible as chips even when controls are collapsed
- Available categories:
  - `heard` (labeled `Attended`, with details modal)
  - `favorite` (flag)
  - `record` (stored as `bought` category key, with details modal)
  - `alert` (flag)
- Includes a `Notes` tab for private per-composer notes (owner-only, max 500 chars)
- Heard details include extended vocal data entry:
  - choir/solo mini-grid with multiple lines
  - vocal role selector (`Choir`, `Solo`, `Tenor`, etc.)
  - vocalist/group name input (max 140 chars)
- Heard/Record place supports selectable defaults and custom typed entries
- If biography is missing, lazily invokes Edge Function to fetch Wikipedia summary
- Biography preview is intentionally short for readability
- Composer header includes a quick `here` link that jumps to footer contact for missing-artist suggestions
- Composer not-found state directs users to the footer contact area to suggest missing artists

#### Zibaldone

- Loads all works with linked composer metadata
- Uses batched Supabase reads so catalogs larger than 1000 rows are fully loaded
- Includes one daily random recommendation per signed-in user
- Reuses the same recommendation until end of day (23:59)
- Avoids repeating works already recommended during the previous 365 days
- Search by work title or composer name
- Filters by epoch and genre
- Sort by title/composer/epoch/genre
- Pagination with configurable page size

#### Profile

- Shows user logs expanded by category
- Tabs: `All`, `Heard`, `Favorites`, `Records`, `Alerts`, `Notes`
- For detailed categories (`heard`, `bought`), supports editing category-specific fields
- Supports category deletion per work
- Includes personal notes in dedicated `Notes` tab:
  - Add note (max 500 chars)
  - Delete note
  - Full chronological list of saved notes

#### Stats

- Uses only logs tagged as `heard`
- Chart 1: top composers by listen count
- Top-composer chart uses angled x-axis labels so long names stay readable
- Tooltip styling uses dark theme colors for readability
- Chart 2: heard logs by year with full epoch buckets (`Medieval`, `Renaissance`, `Baroque`, `Classical`, `Early Romantic`, `Late Romantic`, `Romantic`, `20th Century`, `Post-War`, `21st Century`, `Other`)
- Epoch-by-year chart includes visible legend and distinct color per epoch bucket
- Epoch tooltip shows only present values (non-zero buckets), with opaque styling for readability

#### Favicons

- Website favicon assets are served from `public/` (`favicon.ico`, PNG sizes, Apple touch icon)
- `index.html` includes favicon and `site.webmanifest` links

#### Auth

- Login with email/password
- Signup with password policy:
  - minimum 12 chars
  - at least 1 special character
  - confirm password must match
- Password reset email
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

- `getComposerCatalog()` for Browse
- `getComposerById()` and `getWorksByComposerId()` for Composer page
- `getWorksIndex()` for Zibaldone

### 3) User-generated data

Service: `src/services/logService.js`

- One row per `(user_id, work_id)` in `user_logs`
- Multiple categories stored in `categories text[]`
- Per-category metadata stored in `details jsonb` under keys like `details.heard` and `details.bought`
- Toggling/removing categories updates arrays/details and deletes row when no categories remain

### 4) Personal notes

Service: `src/services/noteService.js`

- Per-user profile notes are stored in `profile_notes`
- Max note length is 500 characters (validated in client and DB)
- Notes are listed in profile, ordered by `updated_at` descending

### 5) Lazy enrichment (biography)

Supabase Edge Function: `supabase/functions/wikipedia-enrichment/index.ts`

- Triggered by Composer page when `composer.bio` is empty
- Looks up composer in DB
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
- Additional btree indexes for common joins/filters

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
- Enrichment is attempted once per page load when `bio` is empty
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

Defined in `supabase/schema.sql`, validated by `supabase/rls_test.sql`.

- Public read access: `composers`, `works`
- Owner-only access: `profiles`, `user_logs`, `profile_notes` (select/insert/update/delete)
- Owner-only access: `composer_notes`, `daily_recommendations` (select/insert/update/delete as needed)
- Insert/update checks enforce `auth.uid()` ownership

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

If upgrading from an earlier phase, run:

- `supabase/migrations/20260407_phase3_phase4.sql`
- `supabase/migrations/20260409_profile_notes.sql`
- `supabase/migrations/202604100001_composer_notes_daily_recommendations.sql`

### 4) Seed catalog

```bash
npm run seed
```

### 5) Deploy enrichment function

```bash
supabase functions deploy wikipedia-enrichment --no-verify-jwt
```

If you deploy without `--no-verify-jwt`, ensure invocation/auth policy matches your frontend user flow.

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

## Key folders

```text
src/
	components/      UI shell, modal, error boundary
	lib/             shared constants + Supabase client
	pages/           route pages
	services/        data access and mutation logic
supabase/
	schema.sql       full schema + RLS + triggers
	migrations/      incremental schema changes
	rls_test.sql     RLS verification checklist
	functions/
		wikipedia-enrichment/
scripts/
	seed-openopus.mjs
```
