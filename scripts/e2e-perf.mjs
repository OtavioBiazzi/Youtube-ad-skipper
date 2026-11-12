// Measures the extension's CPU cost on a YouTube watch page.
//   npm run build && npm run e2e:perf
// Runs the same video twice (without / with the extension) and compares the
// main-thread script and task time reported by Chrome DevTools Protocol.
import { chromium } from "playwright";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const extensionPath = resolve("dist");
const videoUrl = process.env.E2E_VIDEO || "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
const seconds = Number(process.env.E2E_PERF_SECONDS || 60);

async function measure(withExtension) {
  const context = await chromium.launchPersistentContext(await mkdtemp(join(tmpdir(), "yte-perf-")), {
    channel: "chromium",
    headless: true,
    viewport: { width: 1600, height: 900 },
    args: [
      ...(withExtension ? [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] : []),
      "--autoplay-policy=no-user-gesture-required",
      "--mute-audio",
    ],
  });
  if (withExtension) {
    let [worker] = context.serviceWorkers();
    if (!worker) await context.waitForEvent("serviceworker", { timeout: 15000 });
  }
  const page = context.pages()[0] || await context.newPage();
  await page.goto(videoUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#movie_player video", { timeout: 45000 });
  await page.evaluate(() => document.querySelector("#movie_player video")?.play().catch(() => {}));
  await page.waitForTimeout(8000); // let the page settle

  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const read = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const before = await read();
  // Move the mouse now and then, like a viewer (shows/hides the controls).
  for (let i = 0; i < seconds; i += 5) {
    await page.mouse.move(400 + (i % 3) * 200, 300 + (i % 2) * 100);
    await page.waitForTimeout(5000);
  }
  const after = await read();
  await context.close();
  return {
    script: (after.ScriptDuration - before.ScriptDuration) * 1000,
    task: (after.TaskDuration - before.TaskDuration) * 1000,
    layout: (after.LayoutDuration - before.LayoutDuration) * 1000,
    style: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
    heapMb: after.JSHeapUsedSize / 1048576,
  };
}

const base = await measure(false);
const ext = await measure(true);
const row = (label, key, unit = "ms") => {
  const delta = ext[key] - base[key];
  console.log(`${label.padEnd(22)} sem: ${base[key].toFixed(0).padStart(6)}${unit}  com: ${ext[key].toFixed(0).padStart(6)}${unit}  diferença: ${delta >= 0 ? "+" : ""}${delta.toFixed(0)}${unit} (${(delta / seconds).toFixed(1)}${unit}/s)`);
};
console.log(`YouTube, ${seconds}s de vídeo tocando:`);
row("Tempo de scripts", "script");
row("Tempo total de tarefas", "task");
row("Layout", "layout");
row("Recalcular estilo", "style");
console.log(`Memória JS             sem: ${base.heapMb.toFixed(1)}MB  com: ${ext.heapMb.toFixed(1)}MB`);
