// Epoch buckets and colors used by the Discover charts.
export const EPOCH_SERIES = [
  { key: "Medieval", color: "#6f7f95" },
  { key: "Renaissance", color: "#5e9a8b" },
  { key: "Baroque", color: "#b88b3e" },
  { key: "Classical", color: "#ddb560" },
  { key: "Early Romantic", color: "#9d6cc0" },
  { key: "Late Romantic", color: "#c46d8c" },
  { key: "Romantic", color: "#b45f5f" },
  { key: "20th Century", color: "#5d7ebf" },
  { key: "Post-War", color: "#4f98ad" },
  { key: "21st Century", color: "#2a8f6d" },
  { key: "Other", color: "#5a5a5a" },
];

export function toEpochBucket(epoch) {
  if (!epoch) {
    return "Other";
  }

  const normalized = epoch
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.includes("medieval")) {
    return "Medieval";
  }

  if (normalized.includes("renaissance")) {
    return "Renaissance";
  }

  if (normalized.includes("baroque")) {
    return "Baroque";
  }

  if (normalized.includes("classical")) {
    return "Classical";
  }

  if (normalized.includes("early romantic")) {
    return "Early Romantic";
  }

  if (normalized.includes("late romantic")) {
    return "Late Romantic";
  }

  if (normalized === "romantic" || normalized.includes(" romantic")) {
    return "Romantic";
  }

  if (normalized.includes("post-war") || normalized.includes("post war")) {
    return "Post-War";
  }

  if (
    normalized.includes("20th century") ||
    normalized.includes("20th") ||
    normalized.includes("twentieth")
  ) {
    return "20th Century";
  }

  if (
    normalized.includes("21st century") ||
    normalized.includes("21st") ||
    normalized.includes("twenty-first") ||
    normalized.includes("contemporary")
  ) {
    return "21st Century";
  }

  if (normalized.includes("modern")) {
    return "20th Century";
  }

  return "Other";
}

export function getHeardYear(log) {
  const dateFromDetails = log.details?.heard?.date;
  const baseDate = dateFromDetails || log.created_at;

  if (!baseDate) {
    return "Unknown";
  }

  // Date inputs store "YYYY-MM-DD": read the year as typed, without a
  // timezone shift (new Date("2026-01-01") is Dec 31 west of UTC).
  const typedYear = /^(\d{4})-\d{2}-\d{2}$/.exec(baseDate);
  if (typedYear) {
    return typedYear[1];
  }

  const parsedDate = new Date(baseDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Unknown";
  }

  return String(parsedDate.getFullYear());
}
