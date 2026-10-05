# wikipedia-enrichment edge function

## Purpose

Lazy-load a missing composer biography and portrait from the Wikipedia REST API when a composer page is visited and `bio` is null.

## Files

- `index.ts`: entrypoint (reads env, creates the Supabase client, `Deno.serve`)
- `handler.ts`: HTTP handler with injected dependencies (database repository, `fetch`)
- `wikipedia.ts`: title candidates, composer detection, Wikipedia lookups
- `handler.test.ts`: tests (`deno test`), run in CI

## Deploy

```bash
supabase secrets set ALLOWED_ORIGINS="https://<your-domain>,http://localhost:5173"
supabase secrets set ENRICHMENT_ADMIN_SECRET="<long random string>"   # optional
supabase functions deploy wikipedia-enrichment
```

Keep JWT verification on when the project's anon key is a legacy JWT (`eyJ...`). With the new publishable keys (`sb_publishable_...`), deploy with `--no-verify-jwt`; the safeguards below still apply.

## Env vars

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (provided by Supabase)
- `ALLOWED_ORIGINS`: comma-separated browser origins allowed by CORS (default: local dev ports only)
- `ENRICHMENT_ADMIN_SECRET`: enables `force` re-enrichment when sent in the `x-enrichment-admin-secret` header

## Invoke payload

```json
{
  "composerId": "<uuid>"
}
```

Admin re-enrichment of an existing bio: `{ "composerId": "<uuid>", "force": true }` plus the `x-enrichment-admin-secret` header.

## Behavior and safeguards

- Only `POST` (and CORS preflight) from allowed origins; `composerId` must be a UUID
- Skips enrichment when a bio already exists (`reason: "bio_exists"`)
- Atomically claims `composers.enrichment_attempted_at`: at most one Wikipedia lookup per composer every 7 days (`reason: "recently_attempted"`), so repeated or scripted calls cannot hammer Wikipedia or the database
- Calls the Wikipedia summary endpoint with name variants, then MediaWiki search as a fallback (`reason: "no_summary"` when nothing matches)
- Writes `bio`, `wikipedia_url`, and `portrait_url` (only if the portrait is missing) and returns the updated public composer fields
- Errors are logged in the function logs; callers only receive `{ "error": "Enrichment failed" }`

## Test

```bash
deno test supabase/functions/wikipedia-enrichment/
```
