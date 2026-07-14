import { describe, expect, it } from "vitest";
import { getYouTubeVideoIdFromUrl, getYouTubeVideoKeyFromUrl } from "./youtube";

describe("youtube url helpers", () => {
  it("reads regular watch video ids", () => {
    expect(getYouTubeVideoIdFromUrl("https://www.youtube.com/watch?v=abc123&list=PL")).toBe("abc123");
  });

  it("reads embed video ids", () => {
    expect(getYouTubeVideoIdFromUrl("https://www.youtube.com/embed/xyz789?autoplay=1")).toBe("xyz789");
  });

  it("reads shorts video ids", () => {
    expect(getYouTubeVideoIdFromUrl("https://www.youtube.com/shorts/short-id")).toBe("short-id");
  });

  it("returns an empty id for non-video urls", () => {
    expect(getYouTubeVideoIdFromUrl("https://www.youtube.com/feed/subscriptions")).toBe("");
  });

  it("uses video ids for stable video keys", () => {
    expect(getYouTubeVideoKeyFromUrl("https://www.youtube.com/watch?v=abc123&t=40s")).toBe("watch:abc123");
  });

  it("falls back to path and query when there is no video id", () => {
    expect(getYouTubeVideoKeyFromUrl("https://www.youtube.com/results?search_query=test")).toBe("/results?search_query=test");
  });
});
