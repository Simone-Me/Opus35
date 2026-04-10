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
