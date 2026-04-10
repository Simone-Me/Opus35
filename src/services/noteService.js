import { hasSupabaseCredentials, supabase } from "../lib/supabaseClient";

const NOTE_MAX_LENGTH = 500;

function normalizeNote(note) {
  return (note || "").trim();
}

export async function getProfileNotes(userId) {
  if (!hasSupabaseCredentials || !userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("profile_notes")
    .select("id,user_id,note,created_at,updated_at")
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

  const normalizedNote = normalizeNote(note);

  if (!normalizedNote) {
    throw new Error("Write a note before saving.");
  }

  if (normalizedNote.length > NOTE_MAX_LENGTH) {
    throw new Error("Note must be 500 characters or fewer.");
  }

  const { data, error } = await supabase
    .from("profile_notes")
    .insert({
      user_id: userId,
      note: normalizedNote,
    })
    .select("id,user_id,note,created_at,updated_at")
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
