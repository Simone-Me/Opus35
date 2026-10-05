import { createClient } from "@supabase/supabase-js";
import {
  createHandler,
  createSupabaseRepository,
  parseAllowedOrigins,
} from "./handler.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "wikipedia-enrichment: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
}

const handler = supabaseUrl && serviceRoleKey
  ? createHandler({
    repository: createSupabaseRepository(
      createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      }),
    ),
    // Comma-separated list, e.g. "https://opus35.fr,https://opus35.netlify.app".
    allowedOrigins: parseAllowedOrigins(
      Deno.env.get("ALLOWED_ORIGINS") ||
        "http://localhost:5173,http://localhost:4173",
    ),
    adminSecret: Deno.env.get("ENRICHMENT_ADMIN_SECRET") || undefined,
  })
  : () =>
    Promise.resolve(
      new Response(JSON.stringify({ error: "Function not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

Deno.serve(handler);
