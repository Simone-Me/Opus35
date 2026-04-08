# Opus35

Opus35 is a lightweight web app to track classical pieces attended at concerts.

## Stack

- Frontend: React + Vite
- Backend/Auth/DB: Supabase
- Charts: Recharts
- Data source: OpenOpus API (primary), Wikipedia REST lazy enrichment, MusicBrainz fallback later
- Hosting: Netlify

## Current project structure

```
.
├─ netlify.toml
├─ scripts/
│  └─ seed-openopus.mjs
├─ src/
│  ├─ components/
│  │  ├─ AppShell.jsx
│  │  ├─ CategoryModal.jsx
│  │  └─ ErrorBoundary.jsx
│  ├─ lib/
│  │  ├─ categories.js
│  │  └─ supabaseClient.js
│  ├─ pages/
│  │  ├─ AuthPage.jsx
│  │  ├─ BrowsePage.jsx
│  │  ├─ ComposerPage.jsx
│  │  ├─ NotFoundPage.jsx
│  │  ├─ ProfilePage.jsx
│  │  └─ StatsPage.jsx
│  ├─ services/
│  │  ├─ catalogService.js
│  │  └─ logService.js
│  ├─ App.jsx
│  ├─ index.css
│  └─ main.jsx
└─ supabase/
	├─ schema.sql
	├─ rls_test.sql
	├─ migrations/
	│  └─ 20260407_phase3_phase4.sql
	└─ functions/
		└─ wikipedia-enrichment/
			├─ index.ts
			└─ README.md
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment values:

```bash
cp .env.example .env
```

Required values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

3. Run Supabase SQL from `supabase/schema.sql` in your Supabase SQL editor.

If your DB was created before Phase 3, run `supabase/migrations/20260407_phase3_phase4.sql`.

4. Seed composers and works:

```bash
npm run seed
```

5. Start frontend:

```bash
npm run dev
```

## Data model note

`user_logs` now stores one row per `(user_id, work_id)` with:

- `categories text[]`: contains one or more of `heard`, `favorite`, `bought`, `alert`
- `details jsonb`: keyed by category (`details.heard`, `details.bought`)

This allows one work to live in multiple categories with category-specific detail payloads.

## Netlify deploy and env

Add these site environment variables in Netlify:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Build settings are already in `netlify.toml` with SPA redirect fallback.

## Supabase Edge Function (Wikipedia enrichment)

Deploy function:

```bash
supabase functions deploy wikipedia-enrichment --no-verify-jwt
```

The app invokes this lazily from the composer page only when `bio` is null.

## RLS security checks

Use `supabase/rls_test.sql` to validate policy behavior before production launch.

## Implemented features

- Error boundary around the app shell
- Browse page:
  - composer cards with work list and search
  - category buttons (`heard`, `favorite`, `bought`, `alert`)
  - epoch and genre filter chips
  - loading skeletons and empty states
- Composer page with lazy Wikipedia enrichment trigger
- Profile page with tabs (`All`, `Heard`, `Favorites`, `Bought`, `Alerts`) and per-category edit/delete
- Stats page:
  - top composers by heard count
  - stacked year-by-epoch breakdown (Baroque/Classical/Romantic/Modern/Other)
- Supabase schema with RLS policies and profile auto-create trigger
- One-time OpenOpus seed script
- Netlify SPA redirect setup

## Phase mapping

### Phase 1

- Step 1: Project scaffold complete
- Step 2: Supabase schema and RLS file ready (`supabase/schema.sql`)
- Step 3: Seed script ready (`scripts/seed-openopus.mjs`)

### Phase 2

- Step 4: Auth page scaffolded with email actions
- Step 5: Browse page scaffolded with grouped works + search
- Step 6: Marking system scaffolded with 4 categories
- Step 7: Heard/Bought detail forms scaffolded in modal

### Phase 3

- Step 8: Profile tabs and per-category CRUD completed on array-based `user_logs`
- Step 9: Charts upgraded with top composers and year-by-epoch bar breakdown

### Phase 4

- Step 10: Supabase Edge Function added for lazy Wikipedia enrichment
- Step 11: Browse filter chips added (epoch + genre) and optional server full-text index prepared
- Step 12: Hardening baseline added (skeletons, empty states, error boundary, RLS test script)
