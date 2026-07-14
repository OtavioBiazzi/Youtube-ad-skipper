const SHORTCUT_MODIFIERS = ["Ctrl", "Alt", "Shift", "Meta"];

export type ShortcutKeyboardEvent = {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
};

export function normalizeShortcutText(value: unknown, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

export function normalizeShortcutSetting(value: unknown, fallback = "") {
  if (value === "") return "";
  return normalizeShortcutText(value, fallback);
}

export function isShortcutSettingKey(key: string) {
  return /^shortcut[A-Z]/.test(key);
}

export function normalizeShortcutToken(token: unknown) {
  const raw = String(token || "");
  if (raw === " ") return "Space";

  const text = raw.trim();
  if (!text) return "";

  const lower = text.toLowerCase();
  if (lower === "control" || lower === "ctrl") return "Ctrl";
  if (lower === "option" || lower === "alt") return "Alt";
  if (lower === "shift") return "Shift";
  if (lower === "cmd" || lower === "command" || lower === "meta") return "Meta";
  if (lower === "escape" || lower === "esc") return "Esc";
  if (lower === "space" || lower === "spacebar") return "Space";
  if (lower.length === 1) return lower.toUpperCase();

  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function normalizeShortcutCombo(combo: unknown) {
  const parts = String(combo || "")
    .split("+")
    .map(normalizeShortcutToken)
    .filter(Boolean);

  const modifiers = SHORTCUT_MODIFIERS.filter(modifier => parts.includes(modifier));
  const key = parts.find(part => !SHORTCUT_MODIFIERS.includes(part)) || "";
  return [...modifiers, key].filter(Boolean).join("+");
}

export function eventToShortcutCombo(event: ShortcutKeyboardEvent) {
  const key = normalizeShortcutToken(event.key);
  if (!key || SHORTCUT_MODIFIERS.includes(key)) return "";

  return [
    event.ctrlKey ? "Ctrl" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey ? "Shift" : "",
    event.metaKey ? "Meta" : "",
    key,
  ].filter(Boolean).join("+");
}

export function shortcutMatches(event: ShortcutKeyboardEvent, combo: unknown) {
  const wanted = normalizeShortcutCombo(combo);
  return !!wanted && eventToShortcutCombo(event) === wanted;
}
