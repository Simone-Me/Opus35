import { hasSupabaseCredentials, supabase } from "../lib/supabaseClient";

const LOG_FIELDS = [
  "id",
  "user_id",
  "work_id",
  "categories",
  "details",
  "created_at",
  "updated_at",
];
const LOG_COLUMNS = LOG_FIELDS.join(",");

function requireClient() {
  if (!hasSupabaseCredentials) {
    throw new Error("Supabase credentials are required to save categories.");
  }
}

// RPCs return `setof user_logs`: one row, or none when the row was deleted.
function firstRow(data) {
  return Array.isArray(data) ? data[0] || null : data || null;
}

export async function getUserLogs(userId) {
  if (!hasSupabaseCredentials || !userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_logs")
    .select(
      `${LOG_COLUMNS},works(id,title,genre,composers(id,name,epoch))`,
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

// Only the logs of one composer's works (inner join filter on works.composer_id).
export async function getUserLogsForComposer(userId, composerId) {
  if (!hasSupabaseCredentials || !userId || !composerId) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_logs")
    .select(`${LOG_COLUMNS},works!inner(composer_id)`)
    .eq("user_id", userId)
    .eq("works.composer_id", composerId);

  if (error) {
    throw error;
  }

  return data || [];
}

// Lightweight list of places already typed by the user (for suggestions).
export async function getUserPlaceLogs(userId) {
  if (!hasSupabaseCredentials || !userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_logs")
    .select("heard_place:details->heard->>place,bought_place:details->bought->>place")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({
    details: {
      heard: { place: row.heard_place },
      bought: { place: row.bought_place },
    },
  }));
}

// Adds a category (and, for detailed categories, replaces its details).
export async function setUserLogCategory({ workId, category, details = null }) {
  requireClient();

  const { data, error } = await supabase.rpc("set_user_log_category", {
    p_work_id: workId,
    p_category: category,
    p_details: details,
  });

  if (error) {
    throw error;
  }

  return firstRow(data);
}

// Returns the remaining log row, or null when the row was deleted.
export async function removeUserLogCategory({ workId, category }) {
  requireClient();

  const { data, error } = await supabase.rpc("remove_user_log_category", {
    p_work_id: workId,
    p_category: category,
  });

  if (error) {
    throw error;
  }

  return firstRow(data);
}

// Returns the resulting log row, or null when the row was deleted.
export async function toggleUserLogCategory({ workId, category }) {
  requireClient();

  const { data, error } = await supabase.rpc("toggle_user_log_category", {
    p_work_id: workId,
    p_category: category,
  });

  if (error) {
    throw error;
  }

  return firstRow(data);
}

// Applies an RPC result to a list of logs. Only user_logs columns are taken
// from the result, so joined data already loaded (e.g. `works`) is kept.
export function applyLogChange(logs, workId, updatedLog) {
  if (!updatedLog) {
    return logs.filter((log) => log.work_id !== workId);
  }

  const columns = Object.fromEntries(
    LOG_FIELDS.filter((field) => field in updatedLog).map((field) => [
      field,
      updatedLog[field],
    ]),
  );
  const index = logs.findIndex((log) => log.work_id === workId);

  if (index === -1) {
    return [columns, ...logs];
  }

  const next = [...logs];
  next[index] = { ...logs[index], ...columns };
  return next;
}
