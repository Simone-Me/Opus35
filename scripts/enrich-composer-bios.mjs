import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

function parseArgs(argv) {
  const args = {
    composer: "",
    limit: 50,
    force: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    if (arg.startsWith("--composer=")) {
      args.composer = arg.slice("--composer=".length).trim();
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (Number.isFinite(value) && value > 0) {
        args.limit = value;
      }
      continue;
    }

    if (arg === "--force") {
      args.force = true;
    }
  }

  return args;
}

function printHelp() {
  console.log(
    `\nUsage:\n  node scripts/enrich-composer-bios.mjs [options]\n\nOptions:\n  --composer=<name or uuid>    Enrich only matching composer(s)\n  --limit=<n>                  Max composers to process (default: 50)\n  --force                      Refresh even when a bio already exists\n  -h, --help                   Show help\n`,
  );
}

async function readDotEnvFile(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    const values = {};

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      values[key] = value;
    }

    return values;
  } catch {
    return {};
  }
}

async function loadDotEnvValues() {
  const files = [".env", ".env.local", ".env.development"];
  const values = {};

  for (const file of files) {
    Object.assign(values, await readDotEnvFile(file));
  }

  return values;
}

function normalizeCandidateLabel(value) {
  return (value || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    (value || "").trim(),
  );
}

function toUnderscoreTitle(value) {
  return normalizeCandidateLabel(value).replace(/\s+/g, "_");
}

function reorderCommaName(value) {
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

function buildSummaryCandidates(name, completeName) {
  const candidates = new Set();
  const baseCandidates = [name, completeName].filter(Boolean);

  for (const rawCandidate of baseCandidates) {
    const variants = new Set([
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

function buildNameSearchTokens(name, completeName) {
  const tokens = new Set();
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

async function fetchWikipediaSummaryByTitle(title) {
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const response = await fetch(summaryUrl, {
    headers: { "User-Agent": "Opus35/1.0 (bio enrichment script)" },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();

  return payload?.extract ? payload : null;
}

function isDisambiguationPayload(payload) {
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

function isLikelyComposerPayload(payload, name, completeName) {
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

async function searchWikipediaTitles(searchQuery) {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&format=json&utf8=1&srlimit=5`;
  const response = await fetch(searchUrl, {
    headers: { "User-Agent": "Opus35/1.0 (bio enrichment script)" },
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  const results = payload?.query?.search || [];
  const titles = results
    .map((result) => toUnderscoreTitle(result?.title || ""))
    .filter(Boolean);

  return Array.from(new Set(titles));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const dotEnv = await loadDotEnvValues();
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    dotEnv.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    dotEnv.VITE_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || dotEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Create .env from .env.example with real values.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let query = supabase
    .from("composers")
    .select("id,name,complete_name,bio,portrait_url")
    .limit(args.limit);

  if (!args.force) {
    query = query.or("bio.is.null,bio.eq.");
  }

  if (args.composer) {
    if (isUuidLike(args.composer)) {
      query = query.eq("id", args.composer);
    } else {
      query = query.or(
        `name.ilike.%${args.composer}%,complete_name.ilike.%${args.composer}%`,
      );
    }
  }

  const { data: composers, error } = await query;

  if (error) {
    throw error;
  }

  const rows = composers || [];
  let updated = 0;

  for (const composer of rows) {
    const candidates = buildSummaryCandidates(
      composer.name,
      composer.complete_name,
    );
    let wikipediaPayload = null;
    let wikipediaUrl = "";

    for (const candidateTitle of candidates) {
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

      for (const queryText of fallbackQueries) {
        const fallbackTitles = await searchWikipediaTitles(queryText);

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
      continue;
    }

    const { error: updateError } = await supabase
      .from("composers")
      .update({
        bio: (wikipediaPayload.extract || "").trim(),
        wikipedia_url: wikipediaUrl || null,
        portrait_url:
          composer.portrait_url || wikipediaPayload.thumbnail?.source || null,
      })
      .eq("id", composer.id);

    if (!updateError) {
      updated += 1;
      console.log(`Updated bio: ${composer.complete_name || composer.name}`);
    }
  }

  console.log(`Done. Updated composers: ${updated}/${rows.length}`);
}

main().catch((error) => {
  console.error(error.message || "Unexpected error");
  process.exit(1);
});
