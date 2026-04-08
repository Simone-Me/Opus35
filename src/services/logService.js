import { hasSupabaseCredentials, supabase } from "../lib/supabaseClient";

export async function getUserLogs(userId) {
  if (!hasSupabaseCredentials || !userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_logs")
    .select(
      "id,user_id,work_id,categories,details,created_at,updated_at,works(id,title,genre,composers(id,name,epoch,bio,portrait_url,wikipedia_url))",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

async function getSingleLog(userId, workId) {
  const { data, error } = await supabase
    .from("user_logs")
    .select("id,user_id,work_id,categories,details,created_at,updated_at")
    .eq("user_id", userId)
    .eq("work_id", workId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function mergeCategoryDetails(existingDetails, category, categoryDetails) {
  const merged = { ...(existingDetails || {}) };

  if (categoryDetails && Object.keys(categoryDetails).length > 0) {
    merged[category] = categoryDetails;
  }

  return merged;
}

export async function upsertUserLogCategory({
  userId,
  workId,
  category,
  details,
}) {
  const existing = await getSingleLog(userId, workId);

  if (!existing) {
    const payload = {
      user_id: userId,
      work_id: workId,
      categories: [category],
      details: mergeCategoryDetails({}, category, details),
    };

    const { data, error } = await supabase
      .from("user_logs")
      .insert(payload)
      .select("id,user_id,work_id,categories,details,created_at,updated_at")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const categories = Array.from(
    new Set([...(existing.categories || []), category]),
  );
  const mergedDetails = mergeCategoryDetails(
    existing.details,
    category,
    details,
  );

  const { data, error } = await supabase
    .from("user_logs")
    .update({
      categories,
      details: mergedDetails,
    })
    .eq("id", existing.id)
    .select("id,user_id,work_id,categories,details,created_at,updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function removeUserLogCategory({ userId, workId, category }) {
  const existing = await getSingleLog(userId, workId);

  if (!existing) {
    return;
  }

  const categories = (existing.categories || []).filter(
    (value) => value !== category,
  );
  const nextDetails = { ...(existing.details || {}) };
  delete nextDetails[category];

  if (categories.length === 0) {
    const { error } = await supabase
      .from("user_logs")
      .delete()
      .eq("id", existing.id)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from("user_logs")
    .update({
      categories,
      details: nextDetails,
    })
    .eq("id", existing.id)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function toggleUserLogCategory({ userId, workId, category }) {
  const existing = await getSingleLog(userId, workId);
  const isActive = Boolean(existing?.categories?.includes(category));

  if (isActive) {
    await removeUserLogCategory({ userId, workId, category });
    return { active: false };
  }

  await upsertUserLogCategory({ userId, workId, category });
  return { active: true };
}
