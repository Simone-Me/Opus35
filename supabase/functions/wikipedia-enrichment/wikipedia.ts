// Pure Wikipedia lookup logic, shared by the Edge Function handler and its tests.
// deno-lint-ignore-file no-explicit-any

const USER_AGENT = "Opus35/1.0 (Wikipedia enrichment)";

export function normalizeCandidateLabel(value: string) {
  return (value || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function toUnderscoreTitle(value: string) {
  return normalizeCandidateLabel(value).replace(/\s+/g, "_");
}

export function reorderCommaName(value: string) {
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

export function buildNameSearchTokens(name: string, completeName: string) {
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

export function buildSummaryCandidates(name: string, completeName: string) {
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

export async function fetchWikipediaSummaryByTitle(
  title: string,
  fetchImpl: typeof fetch = fetch,
) {
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${
    encodeURIComponent(title)
  }`;
  const wikiResponse = await fetchImpl(summaryUrl, {
    headers: {
      "User-Agent": USER_AGENT,
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

export function isDisambiguationPayload(payload: any) {
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

export function isLikelyComposerPayload(
  payload: any,
  name: string,
  completeName: string,
) {
  if (isDisambiguationPayload(payload)) {
    return false;
  }

  const haystack = `${payload?.title || ""} ${payload?.description || ""} ${
    payload?.extract || ""
  }`.toLowerCase();
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

export async function searchWikipediaTitles(
  searchQuery: string,
  fetchImpl: typeof fetch = fetch,
) {
  const searchUrl =
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${
      encodeURIComponent(searchQuery)
    }&format=json&utf8=1&srlimit=5`;
  const response = await fetchImpl(searchUrl, {
    headers: {
      "User-Agent": USER_AGENT,
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

  return Array.from(new Set<string>(titles));
}

// Tries direct title candidates first, then MediaWiki search results.
export async function findComposerSummary(
  name: string,
  completeName: string,
  fetchImpl: typeof fetch = fetch,
) {
  for (const candidateTitle of buildSummaryCandidates(name, completeName)) {
    const payload = await fetchWikipediaSummaryByTitle(
      candidateTitle,
      fetchImpl,
    );

    if (payload && isLikelyComposerPayload(payload, name, completeName)) {
      return {
        payload,
        url: payload.content_urls?.desktop?.page ||
          `https://en.wikipedia.org/wiki/${candidateTitle}`,
      };
    }
  }

  const fallbackQueries = [
    `${completeName || name} composer`,
    `${name} composer`,
    `${completeName || name} classical music`,
  ];

  for (const query of fallbackQueries) {
    for (const fallbackTitle of await searchWikipediaTitles(query, fetchImpl)) {
      const payload = await fetchWikipediaSummaryByTitle(
        fallbackTitle,
        fetchImpl,
      );

      if (payload && isLikelyComposerPayload(payload, name, completeName)) {
        return {
          payload,
          url: payload.content_urls?.desktop?.page ||
            `https://en.wikipedia.org/wiki/${fallbackTitle}`,
        };
      }
    }
  }

  return null;
}
