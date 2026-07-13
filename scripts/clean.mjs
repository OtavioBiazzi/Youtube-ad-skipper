import { rm } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targets = ["dist", ".vite-build", "release"];

function assertInsideRoot(path) {
  const resolved = resolve(path);
  const rel = relative(root, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Refusing to clean outside project root: ${resolved}`);
  }
  return resolved;
}

for (const target of targets) {
  await rm(assertInsideRoot(resolve(root, target)), { recursive: true, force: true });
}

console.log("Cleaned generated extension folders");
