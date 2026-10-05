// HTTP handler for the wikipedia-enrichment Edge Function.
// Dependencies (database, fetch, config) are injected so the handler can be
// tested without Supabase or network access (see handler.test.ts).
// deno-lint-ignore-file no-explicit-any
import { findComposerSummary } from "./wikipedia.ts";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const PUBLIC_COMPOSER_COLUMNS =
  "id,name,complete_name,epoch,birth,death,bio,portrait_url,wikipedia_url";

export const ADMIN_SECRET_HEADER = "x-enrichment-admin-secret";

export type Composer = {
  id: string;
  name: string;
  complete_name: string | null;
  bio: string | null;
  portrait_url: string | null;
  [key: string]: unknown;
};

export type EnrichmentUpdate = {
  bio: string;
  wikipedia_url: string | null;
  portrait_url: string | null;
};

export interface ComposerRepository {
  getById(id: string): Promise<Composer | null>;
  // Atomically marks the composer as "lookup in progress/attempted".
  // Returns false when another lookup ran recently or the bio already exists.
  claimEnrichment(
    id: string,
    nowIso: string,
    cutoffIso: string,
    force: boolean,
  ): Promise<boolean>;
  saveEnrichment(id: string, update: EnrichmentUpdate): Promise<Composer>;
}

export type HandlerOptions = {
  repository: ComposerRepository;
  allowedOrigins: string[];
  adminSecret?: string;
  fetchImpl?: typeof fetch;
  retryAfterMs?: number;
  now?: () => Date;
};

export function parseAllowedOrigins(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

export function createSupabaseRepository(supabase: any): ComposerRepository {
  return {
    async getById(id) {
      const { data, error } = await supabase
        .from("composers")
        .select("id,name,complete_name,bio,portrait_url")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },

    async claimEnrichment(id, nowIso, cutoffIso, force) {
      let query = supabase
        .from("composers")
        .update({ enrichment_attempted_at: nowIso })
        .eq("id", id);

      if (!force) {
        query = query
          .is("bio", null)
          .or(
            `enrichment_attempted_at.is.null,enrichment_attempted_at.lt."${cutoffIso}"`,
          );
      }

      const { data, error } = await query.select("id");

      if (error) {
        throw error;
      }

      return Array.isArray(data) && data.length > 0;
    },

    async saveEnrichment(id, update) {
      const { data, error } = await supabase
        .from("composers")
        .update(update)
        .eq("id", id)
        .select(PUBLIC_COMPOSER_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
  };
}

export function createHandler(options: HandlerOptions) {
  const {
    repository,
    allowedOrigins,
    adminSecret,
    fetchImpl = fetch,
    retryAfterMs = DEFAULT_RETRY_AFTER_MS,
    now = () => new Date(),
  } = options;

  return async function handle(request: Request): Promise<Response> {
    const origin = request.headers.get("origin");
    const isOriginAllowed = !origin || allowedOrigins.includes(origin);
    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
    };

    if (origin && isOriginAllowed) {
      corsHeaders["Access-Control-Allow-Origin"] = origin;
    }

    function json(body: unknown, status = 200) {
      return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Browsers on other sites are refused; non-browser callers have no Origin
    // and are bounded by the per-composer throttle below.
    if (!isOriginAllowed) {
      return json({ error: "Origin not allowed" }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    let body: any;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const composerId = body?.composerId;

    if (typeof composerId !== "string" || !UUID_REGEX.test(composerId)) {
      return json({ error: "composerId must be a UUID" }, 400);
    }

    // Re-enrichment of an existing bio is an admin-only operation.
    const providedSecret = request.headers.get(ADMIN_SECRET_HEADER) || "";
    const force = Boolean(
      body?.force &&
        adminSecret &&
        timingSafeEqual(providedSecret, adminSecret),
    );

    if (body?.force && !force) {
      return json({ error: "force requires the admin secret" }, 403);
    }

    try {
      const composer = await repository.getById(composerId);

      if (!composer) {
        return json({ error: "Composer not found" }, 404);
      }

      if (composer.bio && !force) {
        return json({ composer, enriched: false, reason: "bio_exists" });
      }

      const currentTime = now();
      const claimed = await repository.claimEnrichment(
        composer.id,
        currentTime.toISOString(),
        new Date(currentTime.getTime() - retryAfterMs).toISOString(),
        force,
      );

      if (!claimed) {
        return json({
          composer,
          enriched: false,
          reason: "recently_attempted",
        });
      }

      const summary = await findComposerSummary(
        composer.name,
        composer.complete_name || "",
        fetchImpl,
      );

      if (!summary) {
        return json({ composer, enriched: false, reason: "no_summary" });
      }

      const updatedComposer = await repository.saveEnrichment(composer.id, {
        bio: (summary.payload.extract || "").trim(),
        wikipedia_url: summary.url || null,
        portrait_url: composer.portrait_url ||
          summary.payload.thumbnail?.source || null,
      });

      return json({ composer: updatedComposer, enriched: true });
    } catch (error) {
      // Details stay in the function logs; callers get a generic message.
      console.error("wikipedia-enrichment failed", error);
      return json({ error: "Enrichment failed" }, 500);
    }
  };
}
