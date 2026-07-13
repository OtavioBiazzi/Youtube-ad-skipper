import { describe, expect, it } from "vitest";
import { normalizeQualityLevel, pickBestQualityLevel } from "./quality";

describe("quality helpers", () => {
  it("normalizes allowed quality levels", () => {
    expect(normalizeQualityLevel("hd1080")).toBe("hd1080");
    expect(normalizeQualityLevel("auto")).toBe("auto");
    expect(normalizeQualityLevel("nonsense")).toBe("hd720");
    expect(normalizeQualityLevel("nonsense", "")).toBe("");
  });

  it("keeps the requested quality when available", () => {
    expect(pickBestQualityLevel("hd1080", ["medium", "hd720", "hd1080"])).toBe("hd1080");
  });

  it("falls back to the nearest lower available quality", () => {
    expect(pickBestQualityLevel("hd1440", ["medium", "hd720", "hd1080"])).toBe("hd1080");
  });

  it("falls back to the highest available quality when all options are above target", () => {
    expect(pickBestQualityLevel("medium", ["hd1080", "hd720"])).toBe("hd1080");
  });

  it("preserves auto mode", () => {
    expect(pickBestQualityLevel("auto", ["hd720", "hd1080"])).toBe("auto");
  });
});
