import { describe, expect, it } from "vitest";
import { looksLikeAdblockWarningText } from "./adblockWarning";

describe("adblock warning detection", () => {
  it("recognizes warnings in Portuguese and English", () => {
    expect(looksLikeAdblockWarningText("Bloqueadores de anúncios não são permitidos")).toBe(true);
    expect(looksLikeAdblockWarningText("Ad blockers violate YouTube's Terms of Service")).toBe(true);
  });

  it("does not match unrelated dialogs and promotions", () => {
    expect(looksLikeAdblockWarningText("Este vídeo não está disponível")).toBe(false);
    expect(looksLikeAdblockWarningText("Conheça o YouTube Premium")).toBe(false);
    expect(looksLikeAdblockWarningText("Esta ação não é permitida")).toBe(false);
  });
});
