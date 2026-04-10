import { hasSupabaseCredentials, supabase } from "../lib/supabaseClient";

const UNIQUE_VIOLATION_CODE = "23505";

function toIsoDate(value = new Date()) {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function normalizeComposerLink(composerValue) {
  if (Array.isArray(composerValue)) {
    return composerValue[0] || null;
  }

  return composerValue || null;
}

function normalizeRecommendationRecord(record) {
  if (!record) {
    return null;
  }

  return {
    ...record,
    work: record.works
      ? {
          ...record.works,
          composer: normalizeComposerLink(record.works.composers),
        }
      : null,
  };
}

export async function getDailyRecommendation({ userId, day = new Date() }) {
  if (!hasSupabaseCredentials || !userId) {
    return null;
  }

  const dayKey = toIsoDate(day);

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

export async function generateDailyRecommendation({
  userId,
  works,
  day = new Date(),
}) {
  if (!hasSupabaseCredentials || !userId) {
    throw new Error(
      "Sign in and configure Supabase to generate recommendations.",
    );
  }

  if (!Array.isArray(works) || works.length === 0) {
    throw new Error("No works available to generate a recommendation.");
  }

  const existing = await getDailyRecommendation({ userId, day });

  if (existing) {
    return {
      recommendation: existing,
      created: false,
    };
  }

  const dayKey = toIsoDate(day);
  const minDate = addDays(dayKey, -364);

  const { data: usedRecords, error: usedError } = await supabase
    .from("daily_recommendations")
    .select("work_id")
    .eq("user_id", userId)
    .gte("recommendation_date", minDate)
    .lt("recommendation_date", dayKey);

  if (usedError) {
    throw usedError;
  }

  const usedWorkIds = new Set((usedRecords || []).map((item) => item.work_id));

  let candidateWorks = works.filter((work) => !usedWorkIds.has(work.id));

  if (candidateWorks.length === 0) {
    candidateWorks = works;
  }

  const randomIndex = Math.floor(Math.random() * candidateWorks.length);
  const selectedWork = candidateWorks[randomIndex];

  const { error: insertError } = await supabase
    .from("daily_recommendations")
    .insert({
      user_id: userId,
      work_id: selectedWork.id,
      recommendation_date: dayKey,
    });

  if (insertError && insertError.code !== UNIQUE_VIOLATION_CODE) {
    throw insertError;
  }

  const recommendation = await getDailyRecommendation({ userId, day });

  return {
    recommendation,
    created: !insertError,
  };
}
