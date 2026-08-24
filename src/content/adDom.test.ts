import { describe, expect, it } from "vitest";
import { getAdPlaying } from "./adDom";

function createDocument(playerClasses: string[] = [], visibleBadges = 0) {
  const player = {
    classList: {
      contains: (name: string) => playerClasses.includes(name),
    },
    querySelectorAll: () => Array.from({ length: visibleBadges }, () => ({ offsetWidth: 120, offsetHeight: 24 })),
  };

  return {
    getElementById: (id: string) => id === "movie_player" ? player : null,
    querySelector: () => null,
  } as unknown as Document;
}

describe("getAdPlaying", () => {
  it.each(["ad-showing", "ad-interrupting"])("accepts authoritative player state %s", (state) => {
    expect(getAdPlaying(createDocument([state]))).toBe(true);
  });

  it("ignores stale ad badges on a normal video", () => {
    expect(getAdPlaying(createDocument([], 1))).toBe(false);
  });

  it("does not report an ad without a player", () => {
    const doc = { getElementById: () => null, querySelector: () => null } as unknown as Document;
    expect(getAdPlaying(doc)).toBe(false);
  });
});
