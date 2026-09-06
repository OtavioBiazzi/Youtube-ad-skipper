import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldApplyPlaybackRate } from "./shared/playback";

// Execute the actual content-script functions with controlled media and timers.
const source = readFileSync(new URL("./content.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("content.ts", source, ts.ScriptTarget.Latest, true);
const declarations = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
function runtime(names: string[], overrides: Record<string, unknown> = {}) {
  vi.useFakeTimers();
  const video = { playbackRate: 16, paused: false, ended: false, readyState: 4, muted: false, play: vi.fn().mockResolvedValue(undefined) };
  const state: any = {
    video, ad: false, key: "watch:one", navigationInProgress: false,
    playbackInteractionRevision: 0,
    config: { enabled: true, aggressiveSkip: true, muteAds: true, playerSpeedEnabled: true },
    adState: { preAdPlaybackRate: 1, watching: false, postSkipRestoreTimeouts: [] },
    getActiveVideo: () => video, getCurrentVideoKey: () => state.key,
    getAdPlaying: () => state.ad, isAdSkipperActive: () => true,
    normalizePlaybackRate: Number, shouldApplyPlaybackRate,
    getSpeedThroughRate: () => 8, requestMainWorldSpeedThrough: vi.fn(),
    setInterval, clearInterval, setTimeout, clearTimeout, Date,
    window: { setTimeout },
    PLAYBACK_RESTORE_RETRY_MS: 150, PLAYBACK_RESTORE_WINDOW_MS: 2400,
    SPEED_THROUGH_RETRY_MS: 250,
    ...overrides,
  };
  const code = names.map(name => declarations.get(name) || (() => { throw new Error(name); })()).join("\n");
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, state);
  return state;
}
afterEach(() => vi.useRealTimers());

describe("player lifecycle", () => {
  it("stops an old restoration before it can slow down the next ad", () => {
    const r = runtime(["restorePlaybackRate", "startPlaybackRateRestore", "stopPlaybackRateRestore"]);
    r.startPlaybackRateRestore(1);
    expect(r.video.playbackRate).toBe(1);
    r.ad = true;
    r.video.playbackRate = 8;
    vi.advanceTimersByTime(500);
    expect(r.video.playbackRate).toBe(8);
    expect(r.adState.playbackRestoreInterval).toBeNull();
  });

  it("does not restore an old speed onto the next playlist video", () => {
    const r = runtime(["restorePlaybackRate", "startPlaybackRateRestore", "stopPlaybackRateRestore"]);
    r.startPlaybackRateRestore(1);
    r.key = "watch:two";
    r.video.playbackRate = 1.5;
    vi.advanceTimersByTime(500);
    expect(r.video.playbackRate).toBe(1.5);
  });

  it("restarts acceleration after a temporary loss of ad state", () => {
    const r = runtime(["applySpeedThrough", "startSpeedThrough", "stopSpeedThrough"]);
    r.ad = true;
    r.adState.active = true;
    r.startSpeedThrough();
    expect(r.video.playbackRate).toBe(8);
    r.ad = false;
    vi.advanceTimersByTime(250);
    expect(r.adState.speedThroughInterval).toBeNull();
    r.ad = true;
    r.video.playbackRate = 1;
    r.startSpeedThrough();
    expect(r.video.playbackRate).toBe(8);
  });

  it("does not accelerate content and falls back to the bridge if a setter fails", () => {
    const r = runtime(["applySpeedThrough"]);
    r.applySpeedThrough();
    expect(r.video.playbackRate).toBe(16);
    r.ad = true;
    Object.defineProperty(r.video, "playbackRate", { get: () => 1, set: () => { throw new Error("blocked"); } });
    r.applySpeedThrough();
    expect(r.requestMainWorldSpeedThrough).toHaveBeenCalledWith(8, true);
  });

  it("waits for loaded content after a skip and resumes only once", () => {
    const r = runtime(["resumeContentPlaybackAfterSkip"]);
    r.video.paused = true;
    r.video.readyState = 0;
    r.resumeContentPlaybackAfterSkip();
    vi.advanceTimersByTime(450);
    expect(r.video.play).not.toHaveBeenCalled();
    r.video.readyState = 4;
    vi.advanceTimersByTime(1500);
    expect(r.video.play).toHaveBeenCalledTimes(1);
  });

  it.each(["navigation", "interaction"])("cancels post-skip recovery on %s", (reason) => {
    const r = runtime(["resumeContentPlaybackAfterSkip"]);
    r.video.paused = true;
    r.resumeContentPlaybackAfterSkip();
    if (reason === "navigation") r.key = "watch:two";
    else r.playbackInteractionRevision++;
    vi.advanceTimersByTime(2000);
    expect(r.video.play).not.toHaveBeenCalled();
  });

  it("leaves startup and deliberately paused videos alone", () => {
    const r = runtime(["applyPlayerPreferences"]);
    r.video.paused = true;
    expect(() => r.applyPlayerPreferences()).not.toThrow();
    expect(r.video.play).not.toHaveBeenCalled();
    expect(r.video.playbackRate).toBe(16);
  });

  it("restores only the media muted by the extension, including when replaced", () => {
    const r = runtime(["muteVideo", "unmuteVideo"]);
    r.muteVideo();
    expect(r.video.muted).toBe(true);
    const nextVideo = { muted: true };
    r.getActiveVideo = () => nextVideo;
    r.unmuteVideo();
    expect(r.video.muted).toBe(false);
    expect(nextVideo.muted).toBe(true);
  });

  it("preserves an already muted video", () => {
    const r = runtime(["muteVideo", "unmuteVideo"]);
    r.video.muted = true;
    r.muteVideo();
    r.unmuteVideo();
    expect(r.video.muted).toBe(true);
  });

  it("activates only below the original player and releases when scrolling back", () => {
    let bottom = -20;
    const r = runtime(["shouldUseMiniplayer"], {
      config: { enabled: true, miniplayerEnabled: true },
      isWatchPage: () => true, document: {}, window: { scrollY: 800 },
      getYouTubePlayer: () => ({ classList: { contains: () => false } }),
      getPlayerAnchor: () => ({ getBoundingClientRect: () => ({ bottom }) }),
      getMastheadHeight: () => 56,
    });
    expect(r.shouldUseMiniplayer()).toBe(true);
    bottom = 100;
    expect(r.shouldUseMiniplayer()).toBe(false);
    bottom = -20;
    r.document.pictureInPictureElement = {};
    expect(r.shouldUseMiniplayer()).toBe(false);
    r.document.pictureInPictureElement = null;
    r.navigationInProgress = true;
    expect(r.shouldUseMiniplayer()).toBe(false);
  });
});
