import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = fileURLToPath(new URL("../public/source/", import.meta.url));
const output = join(outputDirectory, "snackpdf-source.tar.gz");
const checksumOutput = join(outputDirectory, "snackpdf-source.tar.gz.sha256");

const standalone = new Set([
  ".gitignore",
  ".npmrc",
  ".openai/hosting.json",
  "LICENSE",
  "LICENSING.md",
  "README.md",
  "WORK-ORDER-REPORT.md",
  "THIRD_PARTY_NOTICES.md",
  "eslint.config.mjs",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "playwright.config.mjs",
  "tsconfig.json",
  "vite.config.ts",
]);
const roots = ["app/", "build/", "config/", "deploy/", "engine/", "legal/", "public/", "scripts/", "src/", "tests/", "types/", "worker/"];

function forbiddenName(path) {
  const name = basename(path);
  return name === ".DS_Store"
    || /(?:^|\/)\.env(?:\.|$)/.test(path)
    || /(?:^|\/)[^/]* 2(?:\.[^/]*)?$/.test(path)
    || /(?:^|\/)[^/]*(?:\.bak|\.orig|~)$/.test(path);
}

const listed = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
  cwd: projectRoot,
  encoding: "buffer",
});
if (listed.status !== 0) throw new Error(`Could not enumerate source files: ${listed.stderr?.toString("utf8") ?? "git failed"}`);

const candidates = listed.stdout
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .filter((path) => existsSync(join(projectRoot, path)))
  .sort();

for (const path of candidates) {
  if (forbiddenName(path)) throw new Error(`Forbidden source or copy file: ${path}`);
}

const files = candidates.filter((path) => {
  if (path.startsWith("public/source/")) return false;
  return standalone.has(path) || roots.some((root) => path.startsWith(root));
});
if (files.length === 0) throw new Error("The corresponding-source inventory is empty.");

function writeString(buffer, value, offset, length) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > length) throw new Error(`Tar field is too long: ${value}`);
  bytes.copy(buffer, offset);
}

function writeOctal(buffer, value, offset, length) {
  const encoded = value.toString(8).padStart(length - 1, "0");
  if (encoded.length >= length) throw new Error(`Tar number is too large: ${value}`);
  writeString(buffer, `${encoded}\0`, offset, length);
}

function tarNameFields(path) {
  const bytes = Buffer.byteLength(path);
  if (bytes <= 100) return { name: path, prefix: "" };
  const split = path.lastIndexOf("/");
  if (split < 1) throw new Error(`Tar path is too long: ${path}`);
  const prefix = path.slice(0, split);
  const name = path.slice(split + 1);
  if (Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155) throw new Error(`Tar path is too long: ${path}`);
  return { name, prefix };
}

function tarHeader(path, size, mode) {
  const header = Buffer.alloc(512);
  const { name, prefix } = tarNameFields(path);
  writeString(header, name, 0, 100);
  writeOctal(header, mode, 100, 8);
  writeOctal(header, 0, 108, 8);
  writeOctal(header, 0, 116, 8);
  writeOctal(header, size, 124, 12);
  writeOctal(header, 0, 136, 12);
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  writeString(header, "ustar\0", 257, 6);
  writeString(header, "00", 263, 2);
  writeString(header, "root", 265, 32);
  writeString(header, "root", 297, 32);
  writeString(header, prefix, 345, 155);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeString(header, `${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8);
  return header;
}

const archiveParts = [];
for (const relativePath of files) {
  const absolutePath = join(projectRoot, relativePath);
  const details = await stat(absolutePath);
  if (!details.isFile()) throw new Error(`Only regular source files may be archived: ${relativePath}`);
  const bytes = await readFile(absolutePath);
  const archivePath = `snackpdf/${relativePath}`;
  archiveParts.push(tarHeader(archivePath, bytes.length, details.mode & 0o111 ? 0o755 : 0o644));
  archiveParts.push(bytes);
  const padding = (512 - (bytes.length % 512)) % 512;
  if (padding) archiveParts.push(Buffer.alloc(padding));
}
archiveParts.push(Buffer.alloc(1024));

const compressed = gzipSync(Buffer.concat(archiveParts), { level: 9, mtime: 0 });
await mkdir(outputDirectory, { recursive: true });
await writeFile(output, compressed);
const checksum = createHash("sha256").update(compressed).digest("hex");
await writeFile(checksumOutput, `${checksum}  snackpdf-source.tar.gz\n`);
console.log(`Corresponding source: ${files.length} normalized files, ${checksum}`);
