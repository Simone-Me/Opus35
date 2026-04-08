import { hasSupabaseCredentials, supabase } from "../lib/supabaseClient";

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
    .select("id,name,epoch,bio,portrait_url,wikipedia_url")
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
    .select("id,title,genre,popularity,openopus_id,composer_id")
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

  const { data, error } = await supabase
    .from("works")
    .select("id,title,genre,popularity,openopus_id,composers(id,name,epoch)")
    .order("title", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((work) => ({
    ...work,
    composer: normalizeComposerLink(work.composers),
  }));
}
