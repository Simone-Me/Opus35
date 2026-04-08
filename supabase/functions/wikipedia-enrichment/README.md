# wikipedia-enrichment edge function

## Purpose

Lazy-load missing composer biography and portrait from Wikipedia REST API when a composer page is first visited and bio is null.

## Deploy

```bash
supabase functions deploy wikipedia-enrichment --no-verify-jwt
```

If you prefer authenticated invocation only, remove --no-verify-jwt and ensure users are signed in before invocation.

## Required env vars

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

## Invoke payload

```json
{
  "composerId": "<uuid>"
}
```

## Behavior

- Reads composer row by id
- Skips enrichment when bio already exists
- Calls Wikipedia summary endpoint using composer name
- Writes bio, wikipedia_url, and portrait_url (only if portrait missing)
