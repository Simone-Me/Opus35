import { hasSupabaseCredentials, supabase } from "../lib/supabaseClient";
import { toOrIlikePattern } from "../lib/utils";

const COMPOSER_DETAIL_COLUMNS =
  "id,name,complete_name,epoch,birth,death,bio,portrait_url,wikipedia_url";

// Server-side sort keys for the works_index view.
export const WORK_SORT_COLUMNS = {
  title: "title",
  composer: "composer_name",
  epoch: "composer_epoch",
  genre: "genre",
};

export async function getComposerCatalog() {
  if (!hasSupabaseCredentials) {
    return [];
  }

  const { data, error } = await supabase
    .from("composers")
    .select("id,name,complete_name,epoch")
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
    .select(COMPOSER_DETAIL_COLUMNS)
    .eq("id", composerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

// Returns the composer as stored after the enrichment attempt.
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

  return data?.composer || null;
}

export async function getWorksByComposerId(composerId) {
  if (!hasSupabaseCredentials || !composerId) {
    return [];
  }

  const { data, error } = await supabase
    .from("works")
    .select("id,title,genre,publication_year")
    .eq("composer_id", composerId)
    .order("title", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

// One page of the flat works index, filtered and sorted by the database.
export async function getWorksPage({
  query = "",
  epoch = "all",
  genre = "all",
  sortBy = "title",
  sortDirection = "asc",
  page = 1,
  pageSize = 10,
} = {}) {
  if (!hasSupabaseCredentials) {
    return { rows: [], count: 0 };
  }

  const sortColumn = WORK_SORT_COLUMNS[sortBy] || WORK_SORT_COLUMNS.title;
  const from = (page - 1) * pageSize;

  let request = supabase
    .from("works_index")
    .select(
      "id,title,genre,publication_year,composer_id,composer_name,composer_complete_name,composer_epoch",
      { count: "exact" },
    );

  const trimmedQuery = query.trim();

  if (trimmedQuery) {
    const pattern = toOrIlikePattern(trimmedQuery);
    request = request.or(`title.ilike.${pattern},composer_name.ilike.${pattern}`);
  }

  if (epoch !== "all") {
    request = request.eq("composer_epoch", epoch);
  }

  if (genre !== "all") {
    request = request.eq("genre", genre);
  }

  const { data, error, count } = await request
    .order(sortColumn, { ascending: sortDirection === "asc", nullsFirst: false })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) {
    throw error;
  }

  return { rows: data || [], count: count || 0 };
}

export async function getWorkFilterOptions() {
  if (!hasSupabaseCredentials) {
    return { epochs: [], genres: [] };
  }

  const [epochsResult, genresResult] = await Promise.all([
    supabase.from("composer_epochs").select("epoch").order("epoch"),
    supabase.from("work_genres").select("genre").order("genre"),
  ]);

  if (epochsResult.error) {
    throw epochsResult.error;
  }

  if (genresResult.error) {
    throw genresResult.error;
  }

  return {
    epochs: (epochsResult.data || []).map((row) => row.epoch),
    genres: (genresResult.data || []).map((row) => row.genre),
  };
}
