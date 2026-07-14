const ADBLOCK_TERMS = [
  "ad blocker",
  "adblock",
  "bloqueador de anuncio",
  "bloqueador de anuncios",
  "bloqueadores de anuncio",
  "bloqueadores de anuncios",
];

function normalizeWarningText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function looksLikeAdblockWarningText(value: unknown) {
  const text = normalizeWarningText(value);
  if (!text) return false;
  return ADBLOCK_TERMS.some((term) => text.includes(term));
}
