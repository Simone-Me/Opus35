import { hasSupabaseCredentials, supabase } from "../lib/supabaseClient";

const WORKS_INDEX_BATCH_SIZE = 1000;

function normalizeComposerLink(composerValue) {
  if (Array.isArray(composerValue)) {
    return composerValue[0] || null;
  }

  return composerValue || null;
}

export async function getComposerCatalog() {
  if (!hasSupabaseCredentials) {
    return [];
  }

  const { data, error } = await supabase
    .from("composers")
    .select("id,name,complete_name,epoch,bio,portrait_url,wikipedia_url")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getComposerById(composerId) {
  if (!hasSupabaseCredentials || !composerId) {
    return null;
  }

  const { data, error } = await supabase
    .from("composers")
    .select(
      "id,name,complete_name,epoch,birth,death,bio,portrait_url,wikipedia_url",
    )
    .eq("id", composerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function enrichComposerFromWikipedia(composerId) {
  if (!hasSupabaseCredentials) {
    return null;
  }

  const { data, error } = await supabase.functions.invoke(
    "wikipedia-enrichment",
    {
      body: { composerId },
    },
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function getWorksByComposerId(composerId) {
  if (!hasSupabaseCredentials || !composerId) {
    return [];
  }

  const { data, error } = await supabase
    .from("works")
    .select(
      "id,title,genre,publication_year,popularity,openopus_id,composer_id",
    )
    .eq("composer_id", composerId)
    .order("title", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getWorksIndex() {
  if (!hasSupabaseCredentials) {
    return [];
  }

  const rows = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("works")
      .select(
        "id,title,genre,publication_year,popularity,openopus_id,composers(id,name,complete_name,epoch)",
      )
      .order("title", { ascending: true })
      .range(offset, offset + WORKS_INDEX_BATCH_SIZE - 1);

    if (error) {
      throw error;
    }

    const chunk = data || [];

    if (chunk.length === 0) {
      break;
    }

    rows.push(...chunk);

    if (chunk.length < WORKS_INDEX_BATCH_SIZE) {
      break;
    }

    offset += WORKS_INDEX_BATCH_SIZE;
  }

  return rows.map((work) => ({
    ...work,
    composer: normalizeComposerLink(work.composers),
  }));
}
