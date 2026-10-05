// Run with: deno test supabase/functions/wikipedia-enrichment/
// deno-lint-ignore-file no-explicit-any
import {
  ADMIN_SECRET_HEADER,
  type Composer,
  type ComposerRepository,
  createHandler,
  parseAllowedOrigins,
} from "./handler.ts";
import {
  buildSummaryCandidates,
  isLikelyComposerPayload,
} from "./wikipedia.ts";

const ORIGIN = "https://opus35.example";
const COMPOSER_ID = "10000000-0000-0000-0000-000000000001";

function assertEquals(actual: unknown, expected: unknown, message = "") {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);

  if (left !== right) {
    throw new Error(`${message}\nexpected: ${right}\nactual:   ${left}`);
  }
}

function createMemoryRepository(initial: Partial<Composer> = {}) {
  const composer: any = {
    id: COMPOSER_ID,
    name: "Bach",
    complete_name: "Johann Sebastian Bach",
    bio: null,
    portrait_url: null,
    enrichment_attempted_at: null,
    ...initial,
  };
  const calls = { claims: 0, saves: 0 };

  const repository: ComposerRepository = {
    getById(id) {
      return Promise.resolve(id === composer.id ? { ...composer } : null);
    },
    claimEnrichment(_id, nowIso, cutoffIso, force) {
      calls.claims += 1;
      const recent = composer.enrichment_attempted_at &&
        composer.enrichment_attempted_at >= cutoffIso;

      if (!force && (composer.bio || recent)) {
        return Promise.resolve(false);
      }

      composer.enrichment_attempted_at = nowIso;
      return Promise.resolve(true);
    },
    saveEnrichment(_id, update) {
      calls.saves += 1;
      Object.assign(composer, update);
      return Promise.resolve({ ...composer });
    },
  };

  return { repository, composer, calls };
}

function createWikipediaFetch() {
  const requests: string[] = [];

  const fetchImpl = ((input: string | URL | Request) => {
    const url = String(input);
    requests.push(url);

    if (url.includes("/page/summary/Johann_Sebastian_Bach")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            title: "Johann Sebastian Bach",
            description: "German composer (1685–1750)",
            extract: "  Johann Sebastian Bach was a German composer.  ",
            thumbnail: { source: "https://upload.wikimedia.org/bach.jpg" },
            content_urls: {
              desktop: {
                page: "https://en.wikipedia.org/wiki/Johann_Sebastian_Bach",
              },
            },
          }),
          { status: 200 },
        ),
      );
    }

    return Promise.resolve(new Response("{}", { status: 404 }));
  }) as typeof fetch;

  return { fetchImpl, requests };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://functions.example/wikipedia-enrichment", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function setup(initial: Partial<Composer> = {}, adminSecret?: string) {
  const memory = createMemoryRepository(initial);
  const wikipedia = createWikipediaFetch();
  const handler = createHandler({
    repository: memory.repository,
    allowedOrigins: [ORIGIN],
    adminSecret,
    fetchImpl: wikipedia.fetchImpl,
  });

  return { ...memory, ...wikipedia, handler };
}

Deno.test("enriches a composer without bio and returns public data", async () => {
  const { handler, composer, calls } = setup();
  const response = await handler(post({ composerId: COMPOSER_ID }));
  const payload = await response.json();

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("access-control-allow-origin"), ORIGIN);
  assertEquals(payload.enriched, true);
  assertEquals(composer.bio, "Johann Sebastian Bach was a German composer.");
  assertEquals(composer.portrait_url, "https://upload.wikimedia.org/bach.jpg");
  assertEquals(calls.saves, 1);
});

Deno.test("throttles repeated lookups for the same composer", async () => {
  const { handler, requests, calls } = setup({
    name: "Nobody",
    complete_name: "Nobody Known",
  });

  const first = await (await handler(post({ composerId: COMPOSER_ID }))).json();
  const requestsAfterFirst = requests.length;
  const second = await (await handler(post({ composerId: COMPOSER_ID })))
    .json();

  assertEquals(first.reason, "no_summary");
  assertEquals(second.reason, "recently_attempted");
  assertEquals(
    requests.length,
    requestsAfterFirst,
    "no Wikipedia calls while throttled",
  );
  assertEquals(calls.saves, 0);
});

Deno.test("does not touch an existing bio", async () => {
  const { handler, requests, calls } = setup({ bio: "Existing" });
  const payload = await (await handler(post({ composerId: COMPOSER_ID })))
    .json();

  assertEquals(payload.reason, "bio_exists");
  assertEquals(requests.length, 0);
  assertEquals(calls.claims, 0);
});

Deno.test("force without the admin secret is refused", async () => {
  const { handler, calls } = setup({ bio: "Existing" }, "s3cret");

  const noSecret = await handler(
    post({ composerId: COMPOSER_ID, force: true }),
  );
  const wrongSecret = await handler(
    post({ composerId: COMPOSER_ID, force: true }, {
      [ADMIN_SECRET_HEADER]: "nope",
    }),
  );

  assertEquals(noSecret.status, 403);
  assertEquals(wrongSecret.status, 403);
  assertEquals(calls.saves, 0);
});

Deno.test("force is refused when no admin secret is configured", async () => {
  const { handler } = setup({ bio: "Existing" });
  const response = await handler(
    post({ composerId: COMPOSER_ID, force: true }, {
      [ADMIN_SECRET_HEADER]: "",
    }),
  );

  assertEquals(response.status, 403);
});

Deno.test("force with the admin secret re-enriches", async () => {
  const { handler, composer } = setup({ bio: "Old bio" }, "s3cret");
  const response = await handler(
    post({ composerId: COMPOSER_ID, force: true }, {
      [ADMIN_SECRET_HEADER]: "s3cret",
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(composer.bio, "Johann Sebastian Bach was a German composer.");
});

Deno.test("rejects other origins, bad methods and bad input", async () => {
  const { handler } = setup();

  const foreign = await handler(
    post({ composerId: COMPOSER_ID }, { Origin: "https://evil.example" }),
  );
  assertEquals(foreign.status, 403);
  assertEquals(foreign.headers.get("access-control-allow-origin"), null);

  const get = await handler(
    new Request("https://functions.example/x", { headers: { Origin: ORIGIN } }),
  );
  assertEquals(get.status, 405);

  assertEquals((await handler(post("not json"))).status, 400);
  assertEquals(
    (await handler(post({ composerId: "1; drop table" }))).status,
    400,
  );
  assertEquals(
    (await handler(
      post({ composerId: "20000000-0000-0000-0000-000000000009" }),
    )).status,
    404,
  );
});

Deno.test("preflight from an allowed origin succeeds", async () => {
  const { handler } = setup();
  const response = await handler(
    new Request("https://functions.example/x", {
      method: "OPTIONS",
      headers: { Origin: ORIGIN },
    }),
  );

  assertEquals(response.status, 204);
  assertEquals(response.headers.get("access-control-allow-origin"), ORIGIN);
});

Deno.test("errors are not leaked to callers", async () => {
  const failing = createHandler({
    repository: {
      getById: () => Promise.reject(new Error("db password is hunter2")),
      claimEnrichment: () => Promise.resolve(false),
      saveEnrichment: () => Promise.reject(new Error("unused")),
    },
    allowedOrigins: [ORIGIN],
  });
  const originalError = console.error;
  console.error = () => {};

  try {
    const response = await failing(post({ composerId: COMPOSER_ID }));
    assertEquals(response.status, 500);
    assertEquals(await response.json(), { error: "Enrichment failed" });
  } finally {
    console.error = originalError;
  }
});

Deno.test("parseAllowedOrigins trims values and trailing slashes", () => {
  assertEquals(parseAllowedOrigins(" https://a.fr/ , ,http://localhost:5173"), [
    "https://a.fr",
    "http://localhost:5173",
  ]);
});

Deno.test("title candidates and composer detection", () => {
  assertEquals(
    buildSummaryCandidates("Bach", "Johann Sebastian Bach").includes(
      "Johann_Sebastian_Bach",
    ),
    true,
  );
  assertEquals(
    isLikelyComposerPayload(
      { title: "Bach (disambiguation)", extract: "Bach may refer to:" },
      "Bach",
      "Johann Sebastian Bach",
    ),
    false,
  );
});
