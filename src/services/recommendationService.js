import { hasSupabaseCredentials, supabase } from "../lib/supabaseClient";
import { firstRelation, localDayKey } from "../lib/utils";

function normalizeRecommendationRecord(record) {
  if (!record) {
    return null;
  }

  return {
    ...record,
    work: record.works
      ? {
          ...record.works,
          composer: firstRelation(record.works.composers),
        }
      : null,
  };
}

// `dayKey` is the visitor's local calendar day (YYYY-MM-DD), so the
// recommendation changes at local midnight.
export async function getDailyRecommendation({ userId, dayKey = localDayKey() }) {
  if (!hasSupabaseCredentials || !userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("daily_recommendations")
    .select(
      "id,user_id,work_id,recommendation_date,created_at,works(id,title,genre,publication_year,composer_id,composers(id,name,complete_name,epoch))",
    )
    .eq("user_id", userId)
    .eq("recommendation_date", dayKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeRecommendationRecord(data);
}

// The database picks the work (random, not repeated within 365 days) and
// guarantees a single recommendation per user and day.
export async function generateDailyRecommendation({
  userId,
  dayKey = localDayKey(),
}) {
  if (!hasSupabaseCredentials || !userId) {
    throw new Error(
      "Sign in and configure Supabase to generate recommendations.",
    );
  }

  const { error } = await supabase.rpc("generate_daily_recommendation", {
    p_day: dayKey,
  });

  if (error) {
    throw error;
  }

  return getDailyRecommendation({ userId, dayKey });
}
