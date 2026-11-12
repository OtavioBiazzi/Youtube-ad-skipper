// Audit run: turns on old options and checks they really work on YouTube.
import { chromium } from "playwright";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ext = resolve("dist");
const ctx = await chromium.launchPersistentContext(await mkdtemp(join(tmpdir(), "yte-audit-")), {
  channel: "chromium", headless: true, viewport: { width: 1600, height: 900 }, locale: "pt-BR",
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, "--mute-audio", "--autoplay-policy=no-user-gesture-required"],
});
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

let [w] = ctx.serviceWorkers();
if (!w) w = await ctx.waitForEvent("serviceworker", { timeout: 15000 });
const extId = new URL(w.url()).host;
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`chrome-extension://${extId}/popup.html`);
await page.evaluate(() => chrome.storage.local.set({
  playerDefaultsProfileVersion: 5,
  qualityEnabled: true, qualityVideo: "medium",
  playerSpeedEnabled: true, playerSpeedDefault: 1.5,
  playerVolumeEnabled: true, playerVolumeDefault: 30,
  shortcutEnabled: true, shortcutCinema: "Alt+Shift+C",
  appearanceHideShorts: true,
}));

await page.goto("https://www.youtube.com/watch?v=aqz-KE-bpKQ", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("#movie_player video", { timeout: 45000 });
await page.evaluate(() => document.querySelector("#movie_player video")?.play().catch(() => {}));
await page.waitForTimeout(9000);

const state = await page.evaluate(() => {
  const p = document.getElementById("movie_player");
  const v = p.querySelector("video");
  return {
    quality: p.getPlaybackQuality?.(),
    available: p.getAvailableQualityLevels?.(),
    rate: v.playbackRate,
    ytVolume: p.getVolume?.(),
    videoVolume: Math.round(v.volume * 100),
    paused: v.paused,
  };
});
check("quality preference applied through the player API", state.quality === "medium", `quality=${state.quality} available=${(state.available || []).join(",")}`);
check("default speed sticks after YouTube loads the video", Math.abs(state.rate - 1.5) < 0.01, `rate=${state.rate}`);
check("default volume reflected in YouTube's own volume", state.ytVolume === 30, `ytVolume=${state.ytVolume} videoVolume=${state.videoVolume}`);

// Cinema shortcut toggles cinema (not theater).
await page.mouse.click(800, 300);
await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector("#movie_player video")?.play().catch(() => {}));
await page.keyboard.press("Alt+Shift+KeyC");
await page.waitForTimeout(500);
const cinema = await page.evaluate(() => ({
  cinema: document.documentElement.classList.contains("youtube-extension-cinema-active"),
  theater: document.querySelector("ytd-watch-flexy")?.hasAttribute("theater"),
}));
check("Alt+Shift+C toggles cinema mode", cinema.cinema, JSON.stringify(cinema));

// Wheel inside the filter panel must not change volume.
await page.hover("#movie_player");
await page.click("#movie_player .ytp-settings-button");
await page.waitForTimeout(500);
await page.click('.ytp-settings-menu [data-yte-gear="filters"]');
await page.waitForTimeout(400);
const before = await page.evaluate(() => document.getElementById("movie_player").getVolume?.());
const panelBox = await page.locator("#yte-filter-panel").boundingBox();
if (panelBox) {
  await page.mouse.move(panelBox.x + 40, panelBox.y + 60);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(300);
}
const after = await page.evaluate(() => document.getElementById("movie_player").getVolume?.());
check("wheel inside the filter panel does not change volume", before === after, `${before} -> ${after}`);

// "Fora": the bar below the video instead of buttons in the player.
await page.goto(`chrome-extension://${extId}/popup.html`);
await page.evaluate(() => chrome.storage.local.set({ playerControlsEnabled: false, toolbarEnabled: true }));
await page.goto("https://www.youtube.com/watch?v=aqz-KE-bpKQ", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("#tube-shield-player-toolbar button", { timeout: 20000 }).catch(() => {});
const below = await page.evaluate(() => {
  const bar = document.getElementById("tube-shield-player-toolbar");
  return {
    exists: !!bar,
    inPlayer: !!document.getElementById("yte-controls"),
    buttons: bar ? bar.querySelectorAll("[data-toolbar-action]").length : 0,
  };
});
check("'Fora' shows the bar below the video and no in-player buttons", below.exists && !below.inPlayer && below.buttons > 0, JSON.stringify(below));
if (below.exists) {
  await page.click('#tube-shield-player-toolbar [data-toolbar-action="loop"]').catch(() => {});
  await page.waitForTimeout(300);
  const loop = await page.evaluate(() => document.querySelector("#movie_player video")?.loop);
  check("loop button on the bar below works", loop === true, `loop=${loop}`);
}

// Hide Shorts on the home page.
await page.goto("https://www.youtube.com/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
const shorts = await page.evaluate(() => {
  const visible = (el) => el && el.getBoundingClientRect().height > 0;
  const nodes = Array.from(document.querySelectorAll("ytd-rich-shelf-renderer[is-shorts], ytm-shorts-lockup-view-model, ytd-reel-shelf-renderer"));
  return { total: nodes.length, visible: nodes.filter(visible).length };
});
check("Shorts shelves hidden on the home page", shorts.visible === 0, JSON.stringify(shorts));

await ctx.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} audit checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
