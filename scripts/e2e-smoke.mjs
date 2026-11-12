// Real-browser smoke test: loads dist/ into Chromium and exercises YouTube.
//   npm run build && npm run e2e
//   E2E_VIDEO=<watch url> E2E_HEADED=1 E2E_WATCH_SECONDS=90 npm run e2e
import { chromium } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extensionPath = join(root, "dist");
const videoUrl = process.env.E2E_VIDEO || "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
const watchSeconds = Number(process.env.E2E_WATCH_SECONDS || 60);
const screenshotDir = process.env.E2E_SCREENSHOTS || root;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const profile = await mkdtemp(join(tmpdir(), "yte-e2e-"));
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: !process.env.E2E_HEADED,
  viewport: { width: 1366, height: 860 },
  locale: "pt-BR",
  // E2E_NO_EXTENSION=1 runs the same flow on plain YouTube, as a baseline.
  args: [
    ...(process.env.E2E_NO_EXTENSION ? [] : [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ]),
    "--autoplay-policy=no-user-gesture-required",
    "--mute-audio",
  ],
});

try {
  let [worker] = context.serviceWorkers();
  if (!worker && !process.env.E2E_NO_EXTENSION) worker = await context.waitForEvent("serviceworker", { timeout: 15000 });
  check("extension service worker loaded", !!worker || !!process.env.E2E_NO_EXTENSION);

  // Optional settings override, e.g. E2E_SETTINGS='{"miniplayerEnabled":false}'
  if (process.env.E2E_SETTINGS) {
    // Include the profile version so the first-run migration does not overwrite these.
    const overrides = { playerDefaultsProfileVersion: 3, ...JSON.parse(process.env.E2E_SETTINGS) };
    await worker.evaluate((values) => chrome.storage.local.set(values), overrides);
  }

  const page = context.pages()[0] || await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  // Record who calls pause() so a failure points at the culprit.
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.pause;
    window.__yteStacks = [];
    HTMLMediaElement.prototype.pause = function () {
      window.__yteStacks.push(String(new Error().stack).split(String.fromCharCode(10)).slice(1, 7).join(" | "));
      return original.call(this);
    };
  });

  await page.goto(videoUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

  // Consent page (EU) — choose the privacy-preserving option.
  const reject = page.locator('button:has-text("Rejeitar tudo"), button:has-text("Reject all")').first();
  if (await reject.isVisible({ timeout: 4000 }).catch(() => false)) {
    await reject.click();
    await page.waitForLoadState("domcontentloaded");
  }

  await page.waitForSelector("#movie_player video", { timeout: 45000 });

  // Track every pause of the main video, and whether an ad was showing.
  await page.evaluate(() => {
    const w = window;
    w.__yte = { pauses: [], miniToggles: 0 };
    const video = document.querySelector("#movie_player video.html5-main-video") || document.querySelector("#movie_player video");
    w.__yte.events = [];
    for (const type of ["emptied", "abort", "loadstart", "stalled", "waiting", "ended"]) {
      video?.addEventListener(type, () => {
        w.__yte.events.push({ type, t: Math.round((video.currentTime || 0) * 10) / 10, mini: document.documentElement.classList.contains("tube-shield-miniplayer-active"), y: Math.round(window.scrollY), at: Date.now() });
      });
    }
    video?.addEventListener("pause", () => {
      const player = document.getElementById("movie_player");
      w.__yte.pauses.push({ t: video.currentTime, ad: !!player?.classList.contains("ad-showing"), at: Date.now() });
    });
    new MutationObserver(() => { w.__yte.miniToggles += 1; })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  });

  // Make sure it is playing (headless autoplay can be blocked by the page).
  await page.evaluate(() => {
    const v = document.querySelector("#movie_player video");
    if (v && v.paused) v.play().catch(() => {});
  });

  const start = Date.now();
  let sawAd = false;
  let lastTime = 0;
  let maxTime = 0;
  while (Date.now() - start < watchSeconds * 1000) {
    const state = await page.evaluate(() => {
      const v = document.querySelector("#movie_player video");
      const p = document.getElementById("movie_player");
      return { t: v?.currentTime || 0, paused: !!v?.paused, ad: !!p?.classList.contains("ad-showing"), rate: v?.playbackRate || 1 };
    });
    if (state.ad) sawAd = true;
    if (!state.ad) maxTime = Math.max(maxTime, state.t);
    lastTime = state.t;
    await page.waitForTimeout(1000);
  }

  const pauses = await page.evaluate(() => window.__yte.pauses);
  const contentPauses = pauses.filter((p) => !p.ad);
  check("video advanced during the watch window", maxTime > 5, `reached ${maxTime.toFixed(1)}s (ad seen: ${sawAd})`);
  check("no unexpected pauses on the main video", contentPauses.length === 0, JSON.stringify(contentPauses));
  const rate = await page.evaluate(() => document.querySelector("#movie_player video")?.playbackRate || 1);
  check("playback rate is normal after ads", rate <= 2, `rate=${rate}`);

  // Scroll down to comments in small steps and watch the miniplayer.
  await page.evaluate(() => { window.__yte.miniToggles = 0; });
  for (let y = 0; y <= 1800; y += 120) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(800);
  const mini = await page.evaluate(() => {
    const active = document.documentElement.classList.contains("tube-shield-miniplayer-active");
    const rect = document.getElementById("movie_player")?.getBoundingClientRect();
    return { active, toggles: window.__yte.miniToggles, rect: rect && { x: rect.x, y: rect.y, w: rect.width, h: rect.height } };
  });
  check("miniplayer floats after scrolling to comments", mini.active, JSON.stringify(mini.rect));
  check("miniplayer did not flicker while scrolling", mini.toggles <= 4, `html class changes: ${mini.toggles}`);
  check("floating player is on screen", !!mini.rect && mini.rect.w > 200 && mini.rect.y >= 0 && mini.rect.y < 860);
  await page.screenshot({ path: join(screenshotDir, "e2e-miniplayer.png") });

  // Hover jitter right at the threshold must not toggle it on/off.
  await page.evaluate(() => { window.__yte.miniToggles = 0; });
  for (let i = 0; i < 6; i += 1) {
    await page.mouse.wheel(0, i % 2 ? 60 : -60);
    await page.waitForTimeout(150);
  }
  const jitter = await page.evaluate(() => window.__yte.miniToggles);
  check("small scroll jitter keeps the miniplayer stable", jitter <= 2, `class changes: ${jitter}`);

  const sample = () => page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll("video")).map((v) => ({
      inPlayer: !!v.closest("#movie_player"), paused: v.paused, t: Math.round(v.currentTime * 10) / 10, ready: v.readyState, ended: v.ended,
    }));
    const v = document.querySelector("#movie_player video");
    return { playing: !!v && !v.paused, t: v?.currentTime || 0, videos, href: location.href, src: v?.currentSrc || "", err: v?.error?.message || v?.error?.code || null, cls: document.getElementById("movie_player")?.className };
  });
  const first = await sample();
  await page.waitForTimeout(1500);
  const second = await sample();
  // "Playing" = not paused AND time actually moves (catches stalls too).
  const stillPlaying = second.playing && second.t > first.t;
  if (!stillPlaying) {
    console.log("debug", JSON.stringify({ first: { ...first, cls: undefined }, second: { ...second, cls: undefined } }));
    console.log("events", JSON.stringify(await page.evaluate(() => window.__yte.events.slice(-12))));
  }
  const pauseStacks = await page.evaluate(() => ({ stacks: window.__yteStacks, pauses: window.__yte.pauses }));
  // Headless YouTube sometimes reloads the stream ("emptied" with the same URL
  // and no pause() call). That also happens with no extension loaded, so it
  // is reported as a warning instead of a failure.
  const reloadedByYouTube = !stillPlaying && pauseStacks.stacks.length === 0
    && (await page.evaluate(() => window.__yte.events.some((e) => e.type === "emptied")));
  if (reloadedByYouTube) {
    const ytError = await page.evaluate(() => document.querySelector(".ytp-error")?.textContent?.trim() || "");
    console.log(`WARN  video still playing after miniplayer  — YouTube reloaded/errored the stream (no pause() call): ${ytError || "no error text"}`);
  } else {
    check("video still playing after miniplayer", stillPlaying, stillPlaying ? "" : JSON.stringify(pauseStacks).slice(0, 1500));
  }

  // Back to the top: docks again.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  const docked = await page.evaluate(() => !document.documentElement.classList.contains("tube-shield-miniplayer-active"));
  check("miniplayer docks when scrolling back up", docked);
  await page.screenshot({ path: join(screenshotDir, "e2e-docked.png") });

  const log = worker ? await worker.evaluate(() => chrome.storage.local.get("playbackEventLog")) : {};
  const entries = (log.playbackEventLog || []).filter((e) => e.kind === "pause");
  check("extension logged no pauses", entries.length === 0, JSON.stringify(entries));

  const ownErrors = pageErrors.filter((e) => /YouTube Extension|tube-shield|yte-/i.test(e));
  check("no extension errors on the page", ownErrors.length === 0, ownErrors.join(" | "));
} catch (err) {
  check("smoke run completed", false, String(err && err.message || err));
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
