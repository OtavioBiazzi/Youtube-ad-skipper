import { describe, expect, it } from "vitest";
import {
  eventToShortcutCombo,
  isShortcutSettingKey,
  normalizeShortcutCombo,
  normalizeShortcutSetting,
  normalizeShortcutToken,
  shortcutMatches,
} from "./shortcuts";

describe("shortcut helpers", () => {
  it("normalizes aliases and casing", () => {
    expect(normalizeShortcutToken("control")).toBe("Ctrl");
    expect(normalizeShortcutToken("option")).toBe("Alt");
    expect(normalizeShortcutToken("command")).toBe("Meta");
    expect(normalizeShortcutToken("spacebar")).toBe("Space");
    expect(normalizeShortcutToken("a")).toBe("A");
  });

  it("normalizes combo order", () => {
    expect(normalizeShortcutCombo("shift+alt+s")).toBe("Alt+Shift+S");
    expect(normalizeShortcutCombo("Meta+Ctrl+k")).toBe("Ctrl+Meta+K");
  });

  it("allows intentionally empty shortcut settings", () => {
    expect(normalizeShortcutSetting("", "Alt+Shift+S")).toBe("");
    expect(normalizeShortcutSetting("  ", "Alt+Shift+S")).toBe("Alt+Shift+S");
  });

  it("turns keyboard events into combos", () => {
    expect(eventToShortcutCombo({ key: "s", altKey: true, shiftKey: true })).toBe("Alt+Shift+S");
    expect(eventToShortcutCombo({ key: "Shift", shiftKey: true })).toBe("");
  });

  it("matches normalized shortcuts", () => {
    expect(shortcutMatches({ key: "s", altKey: true, shiftKey: true }, "shift+alt+s")).toBe(true);
    expect(shortcutMatches({ key: "s", ctrlKey: true }, "Alt+S")).toBe(false);
  });

  it("detects shortcut setting keys", () => {
    expect(isShortcutSettingKey("shortcutSkipAd")).toBe(true);
    expect(isShortcutSettingKey("toolbarShortcut")).toBe(false);
  });
});
