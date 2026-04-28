import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const distDir = resolve(root, "dist");
const manifestPath = resolve(distDir, "manifest.json");

if (!existsSync(manifestPath)) {
  throw new Error("dist/manifest.json was not generated");
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const referencedFiles = new Set([
  manifest.action?.default_popup,
  manifest.background?.service_worker,
  manifest.options_ui?.page,
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {}),
]);

for (const script of manifest.content_scripts || []) {
  for (const file of script.js || []) referencedFiles.add(file);
  for (const file of script.css || []) referencedFiles.add(file);
}

const missing = [...referencedFiles].filter((file) => file && !existsSync(resolve(distDir, file)));
if (missing.length > 0) {
  throw new Error(`Missing generated extension files: ${missing.join(", ")}`);
}

console.log(`dist manifest ok: ${manifest.name} v${manifest.version}`);
