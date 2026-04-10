// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizeCandidateLabel(value: string) {
  return (value || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toUnderscoreTitle(value: string) {
  return normalizeCandidateLabel(value).replace(/\s+/g, "_");
}

function reorderCommaName(value: string) {
  const normalized = normalizeCandidateLabel(value);

  if (!normalized.includes(",")) {
    return normalized;
  }

  const parts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return normalized;
  }

  return `${parts.slice(1).join(" ")} ${parts[0]}`.replace(/\s+/g, " ").trim();
}

function buildNameSearchTokens(name: string, completeName: string) {
  const tokens = new Set<string>();
  const values = [
    name,
    completeName,
    reorderCommaName(name),
    reorderCommaName(completeName),
  ].filter(Boolean);

  for (const value of values) {
    const parts = normalizeCandidateLabel(value).split(" ").filter(Boolean);

    for (const part of parts) {
      const normalizedPart = part.toLowerCase();

      if (normalizedPart.length >= 3) {
        tokens.add(normalizedPart);
      }
    }
  }

  return Array.from(tokens);
}

function buildSummaryCandidates(name: string, completeName: string) {
  const candidates = new Set<string>();
  const baseCandidates = [name, completeName].filter(Boolean);

  for (const rawCandidate of baseCandidates) {
    const variants = new Set<string>([
      normalizeCandidateLabel(rawCandidate),
      reorderCommaName(rawCandidate),
    ]);

    for (const variant of variants) {
      if (!variant) {
        continue;
      }

      const parts = variant.split(" ").filter(Boolean);
      candidates.add(toUnderscoreTitle(variant));

      if (parts.length >= 2) {
        candidates.add(`${parts[0]}_${parts[parts.length - 1]}`);
      }
    }
  }

  return Array.from(candidates);
}

async function fetchWikipediaSummaryByTitle(title: string) {
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const wikiResponse = await fetch(summaryUrl, {
    headers: {
      "User-Agent": "Opus35/1.0 (Wikipedia enrichment)",
    },
  });

  if (!wikiResponse.ok) {
    return null;
  }

  const payload = await wikiResponse.json();

  if (!payload?.extract) {
    return null;
  }

  return payload;
}

function isDisambiguationPayload(payload: any) {
  const title = (payload?.title || "").toLowerCase();
  const description = (payload?.description || "").toLowerCase();
  const extract = (payload?.extract || "").toLowerCase();

  return (
    payload?.type === "disambiguation" ||
    title.endsWith("(disambiguation)") ||
    description.includes("disambiguation") ||
    extract.includes("may refer to:") ||
    extract.includes("may also refer to:")
  );
}

function isLikelyComposerPayload(
  payload: any,
  name: string,
  completeName: string,
) {
  if (isDisambiguationPayload(payload)) {
    return false;
  }

  const haystack =
    `${payload?.title || ""} ${payload?.description || ""} ${payload?.extract || ""}`.toLowerCase();
  const nameTokens = buildNameSearchTokens(name, completeName);
  const hasNameMatch = nameTokens.some((token) => haystack.includes(token));

  if (!hasNameMatch) {
    return false;
  }

  const composerSignals = [
    " composer",
    " musicians",
    " musician",
    " pianist",
    " violinist",
    " conductor",
    " opera",
    " orchestral",
    " classical music",
  ];

  return composerSignals.some((signal) => haystack.includes(signal));
}

async function searchWikipediaTitles(searchQuery: string) {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&format=json&utf8=1&srlimit=5`;
  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent": "Opus35/1.0 (Wikipedia enrichment)",
    },
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  const results = payload?.query?.search || [];
  const titles = results
    .map((result: any) => toUnderscoreTitle(result?.title || ""))
    .filter(Boolean);

  return Array.from(new Set(titles));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { composerId, force } = await request.json();

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

    if (composer.bio && !force) {
      return new Response(JSON.stringify({ composer, enriched: false }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const searchCandidates = buildSummaryCandidates(
      composer.name,
      composer.complete_name,
    );
    let wikipediaPayload: any = null;
    let wikipediaUrl = "";

    for (const candidateTitle of searchCandidates) {
      const payload = await fetchWikipediaSummaryByTitle(candidateTitle);

      if (
        !payload ||
        !isLikelyComposerPayload(payload, composer.name, composer.complete_name)
      ) {
        continue;
      }

      wikipediaPayload = payload;
      wikipediaUrl =
        payload.content_urls?.desktop?.page ||
        `https://en.wikipedia.org/wiki/${candidateTitle}`;
      break;
    }

    if (!wikipediaPayload) {
      const fallbackQueries = [
        `${composer.complete_name || composer.name} composer`,
        `${composer.name} composer`,
        `${composer.complete_name || composer.name} classical music`,
      ];

      for (const query of fallbackQueries) {
        const fallbackTitles = await searchWikipediaTitles(query);

        for (const fallbackTitle of fallbackTitles) {
          const payload = await fetchWikipediaSummaryByTitle(fallbackTitle);

          if (
            !payload ||
            !isLikelyComposerPayload(
              payload,
              composer.name,
              composer.complete_name,
            )
          ) {
            continue;
          }

          wikipediaPayload = payload;
          wikipediaUrl =
            payload.content_urls?.desktop?.page ||
            `https://en.wikipedia.org/wiki/${fallbackTitle}`;
          break;
        }

        if (wikipediaPayload) {
          break;
        }
      }
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
      bio: (wikipediaPayload.extract || "").trim(),
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
