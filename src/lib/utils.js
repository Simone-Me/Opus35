// Supabase returns a to-one embedded relation as an object, but older
// PostgREST versions (and some joins) return a one-element array.
export function firstRelation(value) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

export function uniqueSorted(items, getValue = (item) => item) {
  const values = new Set();

  items.forEach((item) => {
    const value = getValue(item);

    if (value) {
      values.add(value);
    }
  });

  return Array.from(values).sort((left, right) => left.localeCompare(right));
}

// Calendar day in the visitor's own timezone (YYYY-MM-DD), not UTC.
export function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Builds a quoted PostgREST `ilike` pattern safe to embed in an `.or()` filter:
// LIKE wildcards typed by the user are escaped, and the value is double-quoted
// so commas, dots and parentheses cannot break the filter syntax.
export function toOrIlikePattern(term) {
  const likeEscaped = term
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/\*/g, " ");
  const quoted = `%${likeEscaped}%`.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  return `"${quoted}"`;
}
