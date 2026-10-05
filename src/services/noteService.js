import { validateNote } from "../lib/notes";
import { hasSupabaseCredentials, supabase } from "../lib/supabaseClient";

const NOTE_COLUMNS = "id,user_id,note,created_at,updated_at";

export async function getProfileNotes(userId) {
  if (!hasSupabaseCredentials || !userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("profile_notes")
    .select(NOTE_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function insertProfileNote({ userId, note }) {
  if (!hasSupabaseCredentials || !userId) {
    throw new Error("Supabase credentials are required to save notes.");
  }

  const validation = validateNote(note);

  if (validation.error) {
    throw new Error(validation.error);
  }

  const { data, error } = await supabase
    .from("profile_notes")
    .insert({
      user_id: userId,
      note: validation.note,
    })
    .select(NOTE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteProfileNote({ userId, noteId }) {
  if (!hasSupabaseCredentials || !userId || !noteId) {
    return;
  }

  const { error } = await supabase
    .from("profile_notes")
    .delete()
    .eq("id", noteId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
