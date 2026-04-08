// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { composerId } = await request.json();

    if (!composerId) {
      return new Response(JSON.stringify({ error: "composerId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase env values" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: composer, error: composerError } = await supabase
      .from("composers")
      .select("id,name,complete_name,bio,portrait_url")
      .eq("id", composerId)
      .maybeSingle();

    if (composerError) {
      throw composerError;
    }

    if (!composer) {
      return new Response(JSON.stringify({ error: "Composer not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (composer.bio) {
      return new Response(JSON.stringify({ composer, enriched: false }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const searchCandidates = [composer.name, composer.complete_name].filter(
      Boolean,
    );
    let wikipediaPayload: any = null;
    let wikipediaUrl = "";

    for (const candidate of searchCandidates) {
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candidate)}`;
      const wikiResponse = await fetch(summaryUrl, {
        headers: {
          "User-Agent": "Opus35/1.0 (Wikipedia enrichment)",
        },
      });

      if (!wikiResponse.ok) {
        continue;
      }

      const payload = await wikiResponse.json();
      if (!payload.extract) {
        continue;
      }

      wikipediaPayload = payload;
      wikipediaUrl = payload.content_urls?.desktop?.page || "";
      break;
    }

    if (!wikipediaPayload) {
      return new Response(
        JSON.stringify({
          composer,
          enriched: false,
          reason: "No wikipedia summary",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const updatePayload = {
      bio: wikipediaPayload.extract,
      wikipedia_url: wikipediaUrl || null,
      portrait_url:
        composer.portrait_url || wikipediaPayload.thumbnail?.source || null,
    };

    const { data: updatedComposer, error: updateError } = await supabase
      .from("composers")
      .update(updatePayload)
      .eq("id", composer.id)
      .select(
        "id,name,complete_name,epoch,birth,death,bio,portrait_url,wikipedia_url",
      )
      .single();

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ composer: updatedComposer, enriched: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
