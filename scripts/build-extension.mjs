import { build } from "vite";
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempDir = resolve(root, ".vite-build");
const distDir = resolve(root, "dist");

const entries = [
  { entry: "src/background.ts", file: "background.js", global: "YouTubeAdSkipperBackground" },
  { entry: "src/content.ts", file: "content.js", global: "YouTubeAdSkipperContent" },
  { entry: "src/override.ts", file: "override.js", global: "YouTubeAdSkipperOverride" },
  { entry: "src/popup.ts", file: "popup.js", global: "YouTubeAdSkipperPopup" },
  { entry: "src/options.ts", file: "options.js", global: "YouTubeAdSkipperOptions" },
];

const staticFiles = [
  "manifest.json",
  "popup.html",
  "popup.css",
  "options.html",
  "options.css",
  "icon16.png",
  "icon16_off.png",
  "icon16_stealth.png",
  "icon48.png",
  "icon48_off.png",
  "icon48_stealth.png",
  "icon128.png",
  "icon128_off.png",
  "icon128_stealth.png",
];

function assertInsideRoot(path) {
  const resolved = resolve(path);
  const rel = relative(root, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Refusing to write outside project root: ${resolved}`);
  }
  return resolved;
}

async function cleanDir(path) {
  const resolved = assertInsideRoot(path);
  if (resolved === root) {
    throw new Error("Refusing to clean the project root");
  }
  await rm(resolved, { recursive: true, force: true });
  await mkdir(resolved, { recursive: true });
}

await cleanDir(tempDir);
await cleanDir(distDir);

for (const item of entries) {
  await build({
    configFile: false,
    root,
    logLevel: "warn",
    build: {
      emptyOutDir: false,
      minify: false,
      sourcemap: false,
      target: "es2022",
      outDir: tempDir,
      lib: {
        entry: resolve(root, item.entry),
        name: item.global,
        formats: ["iife"],
        fileName: () => item.file,
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });
}

for (const file of staticFiles) {
  await copyFile(resolve(root, file), resolve(distDir, file));
}

const builtFiles = await readdir(tempDir);
for (const file of builtFiles.filter((name) => name.endsWith(".js"))) {
  await copyFile(resolve(tempDir, file), resolve(distDir, file));
  await copyFile(resolve(tempDir, file), resolve(root, file));
}

await rm(tempDir, { recursive: true, force: true });
console.log(`Extension build ready: ${distDir}`);
