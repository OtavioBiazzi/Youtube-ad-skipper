import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contentSource = readFileSync(new URL("./content.ts", import.meta.url), "utf8");
const overrideSource = readFileSync(new URL("./override.ts", import.meta.url), "utf8");
const optionsSource = readFileSync(new URL("../options.html", import.meta.url), "utf8");

describe("playback pause regression", () => {
  it("does not install automatic pause guards for normal videos", () => {
    expect(contentSource).not.toContain("function pauseVideo(");
    expect(contentSource).not.toContain("background-tab-playback-signal");
    expect(contentSource).not.toContain("autoplay-disable-all");
  });

  it("never seeks media to its end as an ad fallback", () => {
    expect(contentSource).not.toContain("startForceSkipBurst");
    expect(contentSource).not.toContain("video.currentTime = target");
    expect(overrideSource).not.toContain("video.currentTime = target");
    expect(overrideSource).not.toContain("player.seekTo(target");
  });

  it("keeps only the deliberate pause used when opening the popup player", () => {
    const directPauseCalls = contentSource.match(/(?:getActiveVideo\(\)|video)\?*\.pause\(\)/g) || [];
    expect(directPauseCalls).toEqual(["getActiveVideo()?.pause()"]);
  });

  it("resumes content once after a confirmed ad skip", () => {
    expect(contentSource).toContain("function resumeContentPlaybackAfterSkip(");
    expect(contentSource).toContain("adState.skipActionPerformed && adState.wasPlayingBeforeAd");
  });

  it("preserves playback around optional player preference changes", () => {
    expect(contentSource).toContain("function preservePlaybackAfterPreference(");
    expect(contentSource).toContain("preservePlaybackAfterPreference(video, wasPlaying)");
  });

  it("does not expose the removed autoplay pause controls", () => {
    expect(optionsSource).not.toContain("Autoplay e abas");
    expect(optionsSource).not.toContain("opt-autoplay-background");
    expect(optionsSource).not.toContain("opt-autoplay-foreground");
    expect(optionsSource).not.toContain("opt-pause-background-tabs");
  });
});
