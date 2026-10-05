import { validateNote } from "../lib/notes";
import { hasSupabaseCredentials, supabase } from "../lib/supabaseClient";

export async function getComposerNote({ userId, composerId }) {
  if (!hasSupabaseCredentials || !userId || !composerId) {
    return null;
  }

  const { data, error } = await supabase
    .from("composer_notes")
    .select("id,user_id,composer_id,note,created_at,updated_at")
    .eq("user_id", userId)
    .eq("composer_id", composerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

export async function upsertComposerNote({ userId, composerId, note }) {
  if (!hasSupabaseCredentials || !userId || !composerId) {
    throw new Error(
      "Supabase credentials are required to save composer notes.",
    );
  }

  const validation = validateNote(note);

  if (validation.error) {
    throw new Error(validation.error);
  }

  const { data, error } = await supabase
    .from("composer_notes")
    .upsert(
      {
        user_id: userId,
        composer_id: composerId,
        note: validation.note,
      },
      {
        onConflict: "user_id,composer_id",
      },
    )
    .select("id,user_id,composer_id,note,created_at,updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteComposerNote({ userId, composerId }) {
  if (!hasSupabaseCredentials || !userId || !composerId) {
    return;
  }

  const { error } = await supabase
    .from("composer_notes")
    .delete()
    .eq("user_id", userId)
    .eq("composer_id", composerId);

  if (error) {
    throw error;
  }
}
