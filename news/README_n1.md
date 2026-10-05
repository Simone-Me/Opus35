# News and Change Notes

## update_n1 (2026-04-09)

- Navigation menu labels updated:
  - Browse -> Composers
  - Charts & stats -> Discover
  - Removed Auth menu entry
- Logged-in users now get a Logout button with double-click confirmation:
  - First click arms logout for 5 seconds
  - Second click confirms sign out
- Composer page work actions redesigned:
  - Added `streamline-ultimate:music-on-off-1` icon per work row
  - Category buttons are hidden by default and revealed with a smooth slide animation
  - Clicking the same icon again closes the action buttons
- Zibaldone full-catalog fix:
  - Work index now fetches in paged Supabase batches (1000 rows per request)
  - Search/filter now works across the full dataset, not only the first 1000 rows
- This file starts the `news/` versioned update log requested for future changes.

## update_n2 (2026-04-09)

- Composer page identity and detail updates:
  - Main composer title now uses `complete_name` when available (example: Johann Sebastian Bach)
  - Work rows now show publication date near title; fallback is `TBD`
  - Added private composer note area in a dedicated `Notes` tab (owner-only CRUD, max 500 chars)
- Composer action-row interaction update:
  - Redesigned work action row to keep icon and category controls horizontally aligned
  - Improved slide behavior so the icon shifts and action buttons reveal on the same row
- Data model updates:
  - Added `works.publication_year`
  - Added `composer_notes` table with owner-only RLS and one note per user/composer
  - Added `daily_recommendations` table with owner-only RLS and one record per user/day
- Zibaldone daily recommendation feature:
  - Added random recommendation generator button
  - Added info icon `streamline-ultimate:information-circle-bold` with hover help text
  - Recommendation is fixed for the current day (00:00 to 23:59)
  - Recommendation history excludes already-used works for the last 365 days before repeating

## update_n3 (2026-04-09)

- Composer work-card interaction refinements:
  - Increased work-card size and spacing so action buttons are clearly visible
  - Selected categories now remain visible as persistent chips on each work row
  - Category chips stay visible even when the musical-note toggle is closed
  - Improved horizontal slide behavior for category controls
- Category naming update:
  - `Bought copy` label renamed to `Record` in composer and profile UI labels
- Heard/Record detail modal enhancements:
  - Place input now works as a selectable list with defaults plus custom values
  - Default places include `Philharmonie de Paris` and `Opera de Paris`
  - Heard section includes choir controls with:
    - `streamline-ultimate:multiple-users-1` button
    - `streamline-ultimate:arrow-button-right-1` add-line button
  - Added mini-grid for multiple vocal lines (`Choir`, `Solo`, `Tenor`, etc.)
  - Vocal line name input is limited to 50 characters

## update_n4 (2026-04-09)

- Profile page notes UX update:
  - Personal notes moved into a dedicated `Notes` tab in user profile
  - Notes are no longer rendered above category tabs
  - Category tabs (`All`, `Heard`, etc.) now focus only on log entries
- Composer page sizing update:
  - Reduced per-work card size (padding and min-height) for denser listing

## update_n5 (2026-04-10)

- Heard details form re-harmonized in the modal with explicit order:
  - `Date | Place | Orchestra`
  - `Director orchestra | Choir`
  - `Metteur en scene | Comment`
- Choir now has its own field title, and the action button is symbol-only (`>>`).
- Metteur en scene and Comment now follow the same pattern:
  - dedicated field title
  - symbol-only toggle button (`>>`)
  - input/textarea appears when toggled.
- Source link field removed from Heard and Record detail forms (not part of this input workflow).
- Documentation workflow hardened:
  - README now includes a required maintenance policy.
  - Future changes must be reflected in both `README.md` and `news/README_n1.md`.

## update_n6 (2026-04-10)

- Composer Heard row UI refinements:
  - Increased horizontal spacing between the music-note toggle icon and category action buttons.
  - Reduced work-card row height to the minimum practical space by trimming cell padding.
- Wikipedia enrichment robustness update:
  - Bio fetch now tries normalized title candidates such as `First_Last` and full-name underscore variants.
  - Added fallback via MediaWiki search API when direct summary title lookup fails.
- README updated with the new enrichment strategy and the roadmap for composition-date extraction from list pages.

## update_n7 (2026-04-10)

- Added dry-run script for missing composition years:
  - `scripts/propose-wikipedia-work-dates.mjs`
  - `npm run dates:propose`
- Script behavior:
  - scans works with null `publication_year`
  - searches `List_of_compositions_by_*` pages and parses year-bearing lines
  - scores title matches conservatively and emits confidence labels
  - writes proposals to JSON report (`news/date-proposals-YYYYMMDD.json` by default)
  - does not write to DB (safe dry-run only)
- README updated with command usage and optional flags (`--composer`, `--min-score`, `--out`).

## update_n8 (2026-04-10)

- Date proposal script reliability update:
  - now reads config from `.env` and `.env.local` when available
  - supports explicit `--url` and `--key` overrides
  - supports read-only access using `VITE_SUPABASE_ANON_KEY` when service role key is not provided
  - improved error guidance when Supabase config is missing
- Wikipedia composer enrichment matching improved for comma-form names:
  - supports re-ordered forms like `Last, First Middle` -> `First Middle Last`
  - improves hit rate for summary titles such as `First_Last` variants

## update_n9 (2026-04-10)

- Added composer bio backfill utility:
  - `scripts/enrich-composer-bios.mjs`
  - `npm run bios:enrich`
- Purpose:
  - fetch missing Wikipedia summaries for composers and persist them to DB
  - useful when composer page shows no bio and a direct backfill is needed
- Supports optional filters:
  - `--composer=<name>`
  - `--limit=<n>`

## update_n10 (2026-04-10)

- Removed biography truncation across enrichment and display flows.
- Edge function now stores full Wikipedia `extract` text in `composers.bio`.
- Backfill script now writes full biography text (no trimming to preview length).
- Composer page now renders full biography text instead of preview-shortened text.

## update_n11 (2026-04-11)

- Composer page action controls redesign:
  - category buttons are now icon-only actions in the expanded row
  - icon mapping updated to requested Streamline Ultimate icons:
    - `heard`/Attended: `streamline-ultimate:binocular`
    - `record` (`bought` key): `streamline-ultimate:cd-playing`
    - `favorite`: `streamline-ultimate:smiley-smile-1-bold`
    - `alert`: `streamline-ultimate:safety-drown-hand`
  - hover helper text added for Attended/Record/Favorite
- Composer works filtering update:
  - added multi-select action filter chips (`Show all`, `Attended`, `Favorite`, `Record`, `Alert`)
  - supports selecting one or more action chips at the same time
- Missing artist suggestion flow:
  - Browse empty-search state now suggests missing composers with a prefilled mail link
  - global footer now includes an ideas/missing-artists contact section
  - contact links are configurable via `VITE_CONTACT_EMAIL`

## update_n12 (2026-04-11)

- Composer action buttons switched from icon-only to text + icon labels in the work action row:
  - `heard`: `attended` + `streamline-ultimate:binocular`
  - `record` (`bought` key): `own` + `streamline-ultimate:cd-playing`
  - `favorite`: `favorite` + `streamline-ultimate:smiley-smile-1-bold`
  - `alert`: `alert` + `streamline-ultimate:safety-drown-hand`
- Added alert hover helper text: `interested to go / in my alert list`.

## update_n13 (2026-04-11)

- Composer page contact UX update:
  - added a `here` link near composer header that jumps to footer contact section (`#footer-contact`)
- Footer reorganization:
  - redesigned as a clearer classic 3-column footer (`About`, `Contact`, `Sources`)
  - contact area now shows both:
    - a prefilled suggestion `mailto:` action
    - direct visible email address link
- Contact reliability update:
  - suggestion email now falls back to `contact@opus35.fr` when `VITE_CONTACT_EMAIL` is not set

## update_n14 (2026-04-11)

- Footer redesigned to a classic dark multi-column style inspired by enterprise website footers.
- New footer column structure:
  - `Contact`
  - `Navigation`
  - `News and info`
  - `About Opus35`
- Added bottom utility bar with quick links (`Contact us`, `Catalog`, `Account`) and copyright line.
- Preserved `#footer-contact` anchor so composer-page `here` link still jumps to contact section.

## update_n15 (2026-04-11)

- Footer contact behavior update:
  - removed footer `mailto:` actions (for users without configured mail clients)
  - added direct email display plus copy-email icon button
  - added copy feedback notice (`Email copied` / `Copy failed`)
- Footer content updates:
  - renamed `News and info` to `Sources`
  - removed `Supabase` from sources list
  - bottom utility links simplified to `My Profile` only (removed `Catalog` and `Contact us`)
- Footer color palette adjusted to match main app design tokens.

## update_n16 (2026-04-11)

- Composer not-found message updated to guide users toward the footer contact area for suggesting missing artists.

## update_n17 (2026-04-11)

- Browse empty-state message updated to:
  - `No composers match the current filters.`
  - `Did you type "..." correctly? If this artist is not present, you can suggest adding it here.`
- `here` now links to footer contact area anchor (`#footer-contact`) instead of mailto.

## update_n18 (2026-04-11)

- Discover charts improvements:
  - top composers x-axis labels rotated (45°) so long names fit
  - tooltip style updated for dark-theme readability
  - epoch-by-year chart now shows a legend for all epoch buckets
- Favicon integration:
  - extracted provided favicon package into `public/`
  - wired `index.html` to use `favicon.ico`, PNG favicon sizes, Apple touch icon, and `site.webmanifest`

## update_n19 (2026-04-11)

- Discover epoch chart upgraded from broad buckets to full epoch categories:
  - `20th Century`, `21st Century`, `Baroque`, `Classical`, `Early Romantic`, `Late Romantic`, `Medieval`, `Post-War`, `Renaissance`, `Romantic`, plus `Other`
- Added distinct color palette per epoch series in the stacked year chart.

## update_n20 (2026-04-11)

- Discover chart tooltip readability and signal improvements:
  - epoch tooltip now lists only non-zero epoch values for the hovered year
  - tooltip rendering switched to an opaque custom card so text stays readable over chart and legend

## update_n21 (2026-08-21)

- Added GitHub Actions deployment/ops workflows:
  - `.github/workflows/keepalive.yml`: nightly ping (02:00 UTC) to the Supabase REST endpoint to prevent the Free-tier project from pausing after a week of inactivity
  - `.github/workflows/backup.yml`: weekly (Sunday 03:11 UTC) `pg_dump` of the database via the Supabase connection pooler, uploaded as a 30-day-retention workflow artifact (Supabase Free keeps no backups of its own)
- Documented required repo-level Variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and Secrets (`SUPABASE_DB_URL`) for these workflows in `README.md`

## update_n22 (2026-10-05)

Audit follow-up: security, correctness, performance and cleanup.

- Auth:
  - password reset now works end to end: the email link returns to `/auth?mode=recovery`, the app handles the `PASSWORD_RECOVERY` event and shows a `New password` form
  - auth buttons are disabled while a request is in flight; shared password policy helper
  - AppShell takes the user from auth events instead of calling `getUser()` on every event
- Edge Function `wikipedia-enrichment`:
  - `force` is admin-only (`ENRICHMENT_ADMIN_SECRET`), CORS limited to `ALLOWED_ORIGINS`, UUID/method validation, generic error responses
  - per-composer throttle (`composers.enrichment_attempted_at`, one lookup every 7 days) so the public function cannot be used to hammer Wikipedia
  - split into `handler.ts` / `wikipedia.ts` with Deno tests; JWT verification recommended on
- Database (`migrations/202610050001_hardening_rpc_views.sql`, mirrored in `schema.sql`):
  - atomic RPCs for categories (`set_/remove_/toggle_user_log_category`) replace the client read-modify-write that could lose data on double clicks
  - `generate_daily_recommendation(p_day)` picks the work server-side for the visitor's local day
  - `works_index`, `composer_epochs`, `work_genres` views for server-side Zibaldone paging
  - `user_logs.details` must be an object of max 16 KB; extra indexes; `schema.sql` is now idempotent
- Frontend:
  - route-level code splitting (initial JS 855 KB → 247 KB; Recharts only on Discover)
  - Zibaldone filters/sorts/paginates in the database with a debounced, escaped search
  - Browse/Composer/Profile fetch only the columns and logs they need; updates are applied from RPC results instead of full reloads
  - stale responses are ignored when navigating; Composer view is keyed by composer id
  - CategoryModal: no more stale unsaved values after cancel, Escape to close, labelled dialog, saving state
  - Profile details preview no longer shows `[object Object]`; Stats year no longer shifts with timezone
  - unified labels (`Attended`, `Favorite`, `Record`, `Alert`) and shared helpers (categories, notes, pagination, modal state)
- Security headers and caching in `netlify.toml` (CSP, frame/referrer/permissions policies, HSTS, immutable assets)
- Backup workflow: verifies the dump before upload and encrypts it with `BACKUP_PASSPHRASE`
- CI workflow (`ci.yml`): lint, Vitest, build, npm audit, SQL schema/RLS/RPC tests on Postgres, Deno tests
- Dependencies updated (`npm audit`: 0 vulnerabilities); removed unused `unplugin-auto-import`, assets and stray files; `supabase/.temp` is no longer tracked
