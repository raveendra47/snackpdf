import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const serviceWorkerPath = resolve(projectRoot, "public/service-worker.js");
const roots = ["app/", "src/", "worker/", "legal/", "public/"];
const standalone = new Set(["package.json", "package-lock.json", "vite.config.ts", "next.config.ts"]);

const listed = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
  cwd: projectRoot,
  encoding: "buffer",
});
if (listed.status !== 0) throw new Error(`Could not enumerate cache-version inputs: ${listed.stderr?.toString("utf8") ?? "git failed"}`);

const candidates = listed.stdout.toString("utf8")
  .split("\0")
  .filter(Boolean)
  .filter((path) => existsSync(resolve(projectRoot, path)))
  .sort();
for (const path of candidates) {
  const name = basename(path);
  if (name === ".DS_Store"
    || /(?:^|\/)[^/]* 2(?:\.[^/]*)?$/.test(path)
    || /(?:^|\/)[^/]*(?:\.bak|\.orig|~)$/.test(path)) {
    throw new Error(`Forbidden cache-version input: ${path}`);
  }
}

const sourceFiles = candidates
  .filter((path) => !path.startsWith("public/source/"))
  .filter((path) => standalone.has(path) || roots.some((root) => path.startsWith(root)))
  .map((path) => resolve(projectRoot, path));

const hash = createHash("sha256");
for (const path of sourceFiles) {
  const name = relative(projectRoot, path);
  let bytes = await readFile(path);
  if (path === serviceWorkerPath) {
    bytes = Buffer.from(bytes.toString("utf8").replace(
      /const CACHE_VERSION = "snackpdf-[^"]+";/,
      'const CACHE_VERSION = "snackpdf-BUILD";',
    ));
  }
  hash.update(name);
  hash.update("\0");
  hash.update(bytes);
  hash.update("\0");
}

const version = `snackpdf-${hash.digest("hex").slice(0, 20)}`;
const current = await readFile(serviceWorkerPath, "utf8");
const updated = current.replace(
  /const CACHE_VERSION = "snackpdf-[^"]+";/,
  `const CACHE_VERSION = "${version}";`,
);
if (updated === current && !current.includes(`const CACHE_VERSION = "${version}";`)) {
  throw new Error("Could not update the Service Worker cache version.");
}
if (updated !== current) await writeFile(serviceWorkerPath, updated);
console.log(`Service Worker cache version: ${version}`);
