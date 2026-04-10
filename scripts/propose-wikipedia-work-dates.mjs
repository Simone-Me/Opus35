import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php";
const PAGE_BATCH_SIZE = 1000;
const DEFAULT_MIN_SCORE = 0.65;

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "in",
  "on",
  "of",
  "a",
  "an",
  "to",
  "no",
  "nr",
  "op",
  "opus",
  "bwv",
  "k",
  "kv",
  "hob",
  "d",
]);

function parseArgs(argv) {
  const args = {
    help: false,
    composer: "",
    out: "",
    minScore: DEFAULT_MIN_SCORE,
    url: "",
    key: "",
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

    if (arg.startsWith("--out=")) {
      args.out = arg.slice("--out=".length).trim();
      continue;
    }

    if (arg.startsWith("--min-score=")) {
      const value = Number(arg.slice("--min-score=".length));
      if (Number.isFinite(value) && value >= 0 && value <= 1) {
        args.minScore = value;
      }
      continue;
    }

    if (arg.startsWith("--url=")) {
      args.url = arg.slice("--url=".length).trim();
      continue;
    }

    if (arg.startsWith("--key=")) {
      args.key = arg.slice("--key=".length).trim();
    }
  }

  return args;
}

function printHelp() {
  console.log(
    `\nUsage:\n  node scripts/propose-wikipedia-work-dates.mjs [options]\n\nOptions:\n  --composer=<name or uuid>    Filter to one composer by name/id substring\n  --out=<file>                 Output JSON file path\n  --min-score=<0..1>           Minimum score for proposals (default: ${DEFAULT_MIN_SCORE})\n  --url=<supabase_url>         Optional Supabase URL override\n  --key=<supabase_key>         Optional Supabase key override\n  -h, --help                   Show help\n\nNotes:\n  - Dry-run only: this script never writes to the database.\n  - It fetches Wikipedia list pages and proposes publication years for works\n    where publication_year is currently null.\n  - Reads config from process env and .env files when available.\n`,
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
  const candidateFiles = [".env", ".env.local", ".env.development"];
  const loaded = {};

  for (const fileName of candidateFiles) {
    const values = await readDotEnvFile(fileName);
    Object.assign(loaded, values);
  }

  return loaded;
}

function resolveSupabaseConfig({ args, processEnv, dotEnvValues }) {
  const supabaseUrl =
    args.url ||
    processEnv.SUPABASE_URL ||
    processEnv.VITE_SUPABASE_URL ||
    dotEnvValues.SUPABASE_URL ||
    dotEnvValues.VITE_SUPABASE_URL ||
    "";

  const supabaseKey =
    args.key ||
    processEnv.SUPABASE_SERVICE_ROLE_KEY ||
    processEnv.VITE_SUPABASE_ANON_KEY ||
    dotEnvValues.SUPABASE_SERVICE_ROLE_KEY ||
    dotEnvValues.VITE_SUPABASE_ANON_KEY ||
    "";

  const source = {
    url:
      (args.url && "arg:url") ||
      (processEnv.SUPABASE_URL && "env:SUPABASE_URL") ||
      (processEnv.VITE_SUPABASE_URL && "env:VITE_SUPABASE_URL") ||
      (dotEnvValues.SUPABASE_URL && "dotenv:SUPABASE_URL") ||
      (dotEnvValues.VITE_SUPABASE_URL && "dotenv:VITE_SUPABASE_URL") ||
      "",
    key:
      (args.key && "arg:key") ||
      (processEnv.SUPABASE_SERVICE_ROLE_KEY &&
        "env:SUPABASE_SERVICE_ROLE_KEY") ||
      (processEnv.VITE_SUPABASE_ANON_KEY && "env:VITE_SUPABASE_ANON_KEY") ||
      (dotEnvValues.SUPABASE_SERVICE_ROLE_KEY &&
        "dotenv:SUPABASE_SERVICE_ROLE_KEY") ||
      (dotEnvValues.VITE_SUPABASE_ANON_KEY &&
        "dotenv:VITE_SUPABASE_ANON_KEY") ||
      "",
  };

  return {
    supabaseUrl,
    supabaseKey,
    source,
  };
}

function normalizeComposerLink(composerValue) {
  if (Array.isArray(composerValue)) {
    return composerValue[0] || null;
  }

  return composerValue || null;
}

function normalizeCandidateLabel(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toUnderscoreTitle(value) {
  return normalizeCandidateLabel(value).replace(/\s+/g, "_");
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, number) => {
      const codePoint = Number(number);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
    });
}

function htmlToText(value) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return normalizeCandidateLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function extractYear(line) {
  const match = line.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function scoreTitleAgainstLine(workTitle, sourceLine) {
  const normalizedTitle = normalizeText(workTitle);
  const normalizedLine = normalizeText(sourceLine);

  if (!normalizedTitle || !normalizedLine) {
    return 0;
  }

  if (
    normalizedLine.includes(normalizedTitle) &&
    normalizedTitle.length >= 10
  ) {
    return 1;
  }

  const titleTokens = tokenize(workTitle);
  if (titleTokens.length === 0) {
    return 0;
  }

  const lineTokens = new Set(tokenize(sourceLine));
  const tokenHits = titleTokens.filter((token) => lineTokens.has(token)).length;
  const overlap = tokenHits / titleTokens.length;

  const firstBigram = titleTokens.slice(0, 2).join(" ");
  const bigramBonus =
    titleTokens.length >= 2 && normalizedLine.includes(firstBigram) ? 0.08 : 0;

  return Math.min(0.98, overlap + bigramBonus);
}

function confidenceFromScore(score) {
  if (score >= 0.9) {
    return "high";
  }

  if (score >= 0.75) {
    return "medium";
  }

  return "low";
}

function extractYearLinesFromHtml(html) {
  const blocks = [];
  const regex = /<(tr|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;

  for (const match of html.matchAll(regex)) {
    blocks.push(match[2]);
  }

  const uniqueLines = new Map();

  for (const block of blocks) {
    const line = htmlToText(block);
    if (line.length < 12) {
      continue;
    }

    const year = extractYear(line);
    if (!year) {
      continue;
    }

    if (!uniqueLines.has(line)) {
      uniqueLines.set(line, { line, year });
    }
  }

  return Array.from(uniqueLines.values());
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Opus35/1.0 (date proposal dry-run)",
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function fetchWikipediaListPageHtml(pageTitle) {
  const url = `${WIKIPEDIA_API_URL}?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&formatversion=2&redirects=1`;
  const payload = await fetchJson(url);

  return payload?.parse?.text || "";
}

async function searchWikipediaListPageTitle(composerLabel) {
  const query = `intitle:\"List of compositions by\" ${composerLabel}`;
  const url = `${WIKIPEDIA_API_URL}?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&formatversion=2&srlimit=5`;
  const payload = await fetchJson(url);

  const results = payload?.query?.search || [];
  const match = results.find((item) =>
    String(item?.title || "").startsWith("List of compositions by "),
  );

  return match?.title ? toUnderscoreTitle(match.title) : "";
}

function buildListPageCandidates(name, completeName) {
  const candidates = new Set();
  const base = [name, completeName].filter(Boolean);

  for (const value of base) {
    const normalized = normalizeCandidateLabel(value);
    if (!normalized) {
      continue;
    }

    const parts = normalized.split(" ").filter(Boolean);
    candidates.add(`List_of_compositions_by_${toUnderscoreTitle(normalized)}`);

    if (parts.length >= 2) {
      candidates.add(
        `List_of_compositions_by_${parts[0]}_${parts[parts.length - 1]}`,
      );
    }
  }

  return Array.from(candidates);
}

async function loadWorksMissingYears(supabase) {
  const rows = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("works")
      .select(
        "id,title,publication_year,composer_id,composers(id,name,complete_name)",
      )
      .is("publication_year", null)
      .order("composer_id", { ascending: true })
      .range(offset, offset + PAGE_BATCH_SIZE - 1);

    if (error) {
      throw error;
    }

    const chunk = data || [];
    if (chunk.length === 0) {
      break;
    }

    rows.push(...chunk);

    if (chunk.length < PAGE_BATCH_SIZE) {
      break;
    }

    offset += PAGE_BATCH_SIZE;
  }

  return rows.map((row) => ({
    ...row,
    composer: normalizeComposerLink(row.composers),
  }));
}

function groupByComposer(works) {
  const map = new Map();

  for (const work of works) {
    const composerId = work.composer?.id || work.composer_id;
    if (!composerId) {
      continue;
    }

    if (!map.has(composerId)) {
      map.set(composerId, {
        composer: work.composer,
        works: [],
      });
    }

    map.get(composerId).works.push(work);
  }

  return Array.from(map.values());
}

function buildDefaultOutputPath() {
  const now = new Date();
  const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return path.join("news", `date-proposals-${day}.json`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const dotEnvValues = await loadDotEnvValues();
  const { supabaseUrl, supabaseKey, source } = resolveSupabaseConfig({
    args,
    processEnv: process.env,
    dotEnvValues,
  });

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase config. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, or VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY, or pass --url and --key.",
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  console.log(`Using Supabase URL from ${source.url || "unknown"}.`);
  console.log(`Using Supabase key from ${source.key || "unknown"}.`);

  const allMissingYearWorks = await loadWorksMissingYears(supabase);
  let groupedComposers = groupByComposer(allMissingYearWorks);

  if (args.composer) {
    const needle = normalizeText(args.composer);
    groupedComposers = groupedComposers.filter((entry) => {
      const composer = entry.composer || {};
      const haystack = normalizeText(
        `${composer.id || ""} ${composer.name || ""} ${composer.complete_name || ""}`,
      );
      return haystack.includes(needle);
    });
  }

  const proposals = [];
  const unresolvedComposers = [];

  for (const entry of groupedComposers) {
    const composer = entry.composer || {};
    const label = composer.complete_name || composer.name || "Unknown composer";

    const candidates = buildListPageCandidates(
      composer.name,
      composer.complete_name,
    );
    let selectedPageTitle = "";
    let listHtml = "";

    for (const candidate of candidates) {
      const html = await fetchWikipediaListPageHtml(candidate);
      if (!html) {
        continue;
      }

      selectedPageTitle = candidate;
      listHtml = html;
      break;
    }

    if (!listHtml) {
      const fallbackTitle = await searchWikipediaListPageTitle(label);
      if (fallbackTitle) {
        const html = await fetchWikipediaListPageHtml(fallbackTitle);
        if (html) {
          selectedPageTitle = fallbackTitle;
          listHtml = html;
        }
      }
    }

    if (!listHtml) {
      unresolvedComposers.push({
        composerId: composer.id,
        composerName: label,
        reason: "No list page found",
      });
      continue;
    }

    const yearLines = extractYearLinesFromHtml(listHtml);

    if (yearLines.length === 0) {
      unresolvedComposers.push({
        composerId: composer.id,
        composerName: label,
        reason: "List page has no parseable year lines",
        sourcePage: `https://en.wikipedia.org/wiki/${selectedPageTitle}`,
      });
      continue;
    }

    for (const work of entry.works) {
      let bestMatch = null;

      for (const candidateLine of yearLines) {
        const score = scoreTitleAgainstLine(work.title, candidateLine.line);

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            score,
            year: candidateLine.year,
            line: candidateLine.line,
          };
        }
      }

      if (!bestMatch || bestMatch.score < args.minScore) {
        continue;
      }

      proposals.push({
        workId: work.id,
        workTitle: work.title,
        composerId: composer.id,
        composerName: label,
        proposedPublicationYear: bestMatch.year,
        score: Number(bestMatch.score.toFixed(4)),
        confidence: confidenceFromScore(bestMatch.score),
        sourcePage: `https://en.wikipedia.org/wiki/${selectedPageTitle}`,
        sourceLine: bestMatch.line,
      });
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    minScore: args.minScore,
    composerFilter: args.composer || null,
    input: {
      worksMissingYear: allMissingYearWorks.length,
      composersConsidered: groupedComposers.length,
    },
    output: {
      proposals: proposals.length,
      high: proposals.filter((item) => item.confidence === "high").length,
      medium: proposals.filter((item) => item.confidence === "medium").length,
      low: proposals.filter((item) => item.confidence === "low").length,
      unresolvedComposers: unresolvedComposers.length,
    },
    unresolvedComposers,
    proposals,
  };

  const outputPath = args.out || buildDefaultOutputPath();
  await writeFile(outputPath, JSON.stringify(summary, null, 2), "utf8");

  console.log("Dry-run date proposal report generated.");
  console.log(`Output file: ${outputPath}`);
  console.log(
    `Proposals: ${summary.output.proposals} (high: ${summary.output.high}, medium: ${summary.output.medium}, low: ${summary.output.low})`,
  );
  console.log(`Unresolved composers: ${summary.output.unresolvedComposers}`);
  console.log("No database writes were performed.");
}

main().catch((error) => {
  console.error(error.message || "Unexpected error");
  process.exit(1);
});
