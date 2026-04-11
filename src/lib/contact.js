const CONTACT_EMAIL = (
  import.meta.env.VITE_CONTACT_EMAIL || "contact@opus35.fr"
).trim();

export function getContactEmail() {
  return CONTACT_EMAIL;
}

function buildMailto({ subject, body }) {
  if (!CONTACT_EMAIL) {
    return "";
  }

  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildGeneralContactMailto() {
  return buildMailto({
    subject: "Opus35 idea or suggestion",
    body: [
      "Hello Opus35,",
      "",
      "I have an idea/suggestion for the catalog:",
      "",
      "",
      "Thanks,",
    ].join("\n"),
  });
}

export function buildMissingArtistMailto(artistName = "") {
  const normalizedArtistName = artistName.trim();

  return buildMailto({
    subject: normalizedArtistName
      ? `Opus35 missing artist: ${normalizedArtistName}`
      : "Opus35 missing artist suggestion",
    body: [
      "Hello Opus35,",
      "",
      normalizedArtistName
        ? `I could not find this artist/composer in Opus35: ${normalizedArtistName}`
        : "I could not find an artist/composer in Opus35.",
      "Please consider adding this artist to the catalog.",
      "",
      "Optional context (work/title/date):",
      "",
      "Thanks,",
    ].join("\n"),
  });
}
