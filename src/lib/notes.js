export const NOTE_MAX_LENGTH = 500;

// Returns the trimmed note, or an error message for the UI.
export function validateNote(note) {
  const normalizedNote = (note || "").trim();

  if (!normalizedNote) {
    return { note: "", error: "Write a note before saving." };
  }

  if (normalizedNote.length > NOTE_MAX_LENGTH) {
    return {
      note: normalizedNote,
      error: `Note must be ${NOTE_MAX_LENGTH} characters or fewer.`,
    };
  }

  return { note: normalizedNote, error: "" };
}
