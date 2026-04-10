import { createClient } from "@supabase/supabase-js";

const OPENOPUS_COMPOSERS_URL =
  "https://api.openopus.org/composer/list/rec.json";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running the seed.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function toInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function extractPublicationYear(...values) {
  const text = values
    .filter(Boolean)
    .map((value) => String(value))
    .join(" ");

  const match = text.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);

  if (!match) {
    return null;
  }

  return toInteger(match[1]);
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed request (${response.status}): ${url}`);
  }
  return response.json();
}

async function upsertInChunks(tableName, rows, chunkSize = 500) {
  for (const chunk of chunkArray(rows, chunkSize)) {
    const { error } = await supabase.from(tableName).upsert(chunk);
    if (error) {
      throw new Error(`Upsert failed for table ${tableName}: ${error.message}`);
    }
  }
}

async function seed() {
  console.log("Fetching recommended composers from OpenOpus...");
  const composerPayload = await fetchJson(OPENOPUS_COMPOSERS_URL);
  const composers = composerPayload.composers || [];

  if (composers.length === 0) {
    throw new Error("OpenOpus returned no composers.");
  }

  const composerRows = composers.map((composer) => ({
    openopus_id: toInteger(composer.id),
    name: composer.name,
    complete_name: composer.complete_name || null,
    epoch: composer.epoch || null,
    birth: toInteger(composer.birth),
    death: toInteger(composer.death),
    portrait_url: composer.portrait || null,
  }));

  await upsertInChunks("composers", composerRows, 200);
  console.log(`Upserted ${composerRows.length} composers.`);

  const composerIdMap = new Map(
    (
      await supabase
        .from("composers")
        .select("id,openopus_id")
        .then(({ data, error }) => {
          if (error) {
            throw error;
          }
          return data || [];
        })
    ).map((row) => [row.openopus_id, row.id]),
  );

  const workRows = [];

  for (const composer of composers) {
    const composerOpenOpusId = toInteger(composer.id);
    const composerId = composerIdMap.get(composerOpenOpusId);

    if (!composerId) {
      continue;
    }

    const worksUrl = `https://api.openopus.org/work/list/composer/${composerOpenOpusId}/genre/all.json`;

    try {
      const worksPayload = await fetchJson(worksUrl);
      const works = worksPayload.works || [];

      works.forEach((work) => {
        const openopusWorkId = toInteger(work.id);

        if (!openopusWorkId || !work.title) {
          return;
        }

        workRows.push({
          composer_id: composerId,
          openopus_id: openopusWorkId,
          title: work.title,
          genre: work.genre || null,
          publication_year: extractPublicationYear(work.title, work.subtitle),
          popularity: toInteger(work.popular),
        });
      });
    } catch (error) {
      console.warn(
        `Skipping works for composer ${composer.name}: ${error.message}`,
      );
    }
  }

  await upsertInChunks("works", workRows, 500);
  console.log(`Upserted ${workRows.length} works.`);
  console.log("Seed complete.");
}

seed().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
