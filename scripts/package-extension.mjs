import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const releaseDir = resolve(root, "release");

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function assertInsideRoot(path) {
  const resolved = resolve(path);
  const rel = relative(root, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Refusing to write outside project root: ${resolved}`);
  }
  return resolved;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function writeUInt16(value) {
  const buffer = Buffer.allocUnsafe(2);
  buffer.writeUInt16LE(value & 0xffff, 0);
  return buffer;
}

function writeUInt32(value) {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

async function listFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = resolve(dir, entry.name);
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await listFiles(absolute, relativePath));
    } else if (entry.isFile()) {
      files.push({ absolute, path: relativePath.replace(/\\/g, "/") });
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosDate, dosTime } = dosDateTime();

  for (const entry of entries) {
    const name = Buffer.from(entry.path, "utf8");
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(0x0800),
      writeUInt16(0),
      writeUInt16(dosTime),
      writeUInt16(dosDate),
      writeUInt32(crc),
      writeUInt32(data.length),
      writeUInt32(data.length),
      writeUInt16(name.length),
      writeUInt16(0),
      name,
    ]);

    localParts.push(localHeader, data);

    centralParts.push(Buffer.concat([
      writeUInt32(0x02014b50),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(0x0800),
      writeUInt16(0),
      writeUInt16(dosTime),
      writeUInt16(dosDate),
      writeUInt32(crc),
      writeUInt32(data.length),
      writeUInt32(data.length),
      writeUInt16(name.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(offset),
      name,
    ]));

    offset += localHeader.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(entries.length),
    writeUInt16(entries.length),
    writeUInt32(centralDirectory.length),
    writeUInt32(offset),
    writeUInt16(0),
  ]);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

const manifestPath = resolve(distDir, "manifest.json");
if (!existsSync(manifestPath)) {
  throw new Error("dist/manifest.json not found. Run npm run build first.");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const files = await listFiles(distDir);
const fileSet = new Set(files.map((file) => file.path));
const referencedFiles = new Set([
  "manifest.json",
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

const missing = [...referencedFiles].filter((file) => file && !fileSet.has(file));
if (missing.length > 0) {
  throw new Error(`Cannot package extension. Missing files in dist: ${missing.join(", ")}`);
}

const entries = await Promise.all(files.map(async (file) => ({
  path: file.path,
  data: await readFile(file.absolute),
})));

await mkdir(assertInsideRoot(releaseDir), { recursive: true });
const zipName = `youtube-extension-v${manifest.version || "dev"}.zip`;
const zipPath = assertInsideRoot(resolve(releaseDir, zipName));
await writeFile(zipPath, createZip(entries));

console.log(`Packaged ${entries.length} files: ${relative(root, zipPath)}`);
