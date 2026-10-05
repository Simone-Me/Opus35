// Single source of truth for category keys and their user-facing names.
// `bought` is the storage key of the "Record" category.
export const CATEGORIES = {
  heard: {
    label: "Attended",
    pluralLabel: "Attended",
    hint: "attended a performance of the opus",
  },
  favorite: {
    label: "Favorite",
    pluralLabel: "Favorites",
    hint: "marked as a favorite",
  },
  bought: {
    label: "Record",
    pluralLabel: "Records",
    hint: "bought a recording of the opus",
  },
  alert: {
    label: "Alert",
    pluralLabel: "Alerts",
    hint: "interested to go to a performance or buy a record",
  },
};

export const DETAILED_CATEGORIES = ["heard", "bought"];

export const CATEGORY_ORDER = ["heard", "favorite", "bought", "alert"];

export const DEFAULT_PLACE_OPTIONS = ["Philharmonie de Paris", "Opera de Paris"];

export const PROFILE_TABS = [
  { key: "all", label: "All" },
  ...CATEGORY_ORDER.map((key) => ({
    key,
    label: CATEGORIES[key].pluralLabel,
  })),
  { key: "notes", label: "Notes" },
];

export function getCategoryLabel(category) {
  return CATEGORIES[category]?.label || category;
}

const DETAIL_PREVIEW_FIELDS = {
  heard: ["date", "place", "orchestra", "conductor", "stageDirector"],
  bought: ["dateBought", "place", "orchestra", "conductor", "recordingDate"],
};

// Short human-readable summary of a category's details (max 3 values).
export function getDetailsPreview(category, details) {
  if (!DETAILED_CATEGORIES.includes(category)) {
    return "Flag only";
  }

  const values = DETAIL_PREVIEW_FIELDS[category]
    .map((field) => details?.[field])
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());

  const vocals = Array.isArray(details?.vocals)
    ? details.vocals.map((line) => line?.name?.trim()).filter(Boolean)
    : [];

  if (vocals.length > 0) {
    values.push(vocals.join(", "));
  }

  if (values.length === 0) {
    return "No details yet";
  }

  return values.slice(0, 3).join(" · ");
}

// Distinct places already used by the user, merged with the defaults.
export function collectPlaceOptions(logs) {
  const values = new Set(DEFAULT_PLACE_OPTIONS);

  logs.forEach((log) => {
    [log?.details?.heard?.place, log?.details?.bought?.place].forEach(
      (place) => {
        if (typeof place === "string" && place.trim()) {
          values.add(place.trim());
        }
      },
    );
  });

  return Array.from(values).sort((left, right) => left.localeCompare(right));
}
