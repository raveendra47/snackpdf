import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFile, readdir } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ENGINE_FILES,
  ICON_FILES,
  LEGAL_FILES,
  OCR_FILES,
  ROOT_EXPORT_FILES,
  ROUTES,
  SOURCE_FILES,
} from "../config/release-inventory.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputRoot = join(projectRoot, "static-site");
const clientManifestPath = join(projectRoot, "dist/client/.vite/manifest.json");
const origin = "https://www.snackpdf.com";

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameSet(actual, expected, label) {
  assert.deepEqual(sorted(actual), sorted(expected), label);
}

async function filesBelow(root, base = root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path, base));
    else if (entry.isFile()) files.push(relative(base, path).replaceAll("\\", "/"));
    else throw new Error(`Unexpected non-file release entry: ${path}`);
  }
  return files;
}

function routePath(route) {
  return route === "/" ? join(outputRoot, "index.html") : join(outputRoot, route.slice(1), "index.html");
}

function firstMatch(html, pattern, label) {
  const match = html.match(pattern);
  assert.ok(match, label);
  return match[1];
}

function parseServiceWorkerRoutes(source) {
  const match = source.match(/const ROUTES = (\[[\s\S]*?\n\]);/);
  assert.ok(match, "Service Worker route inventory is missing");
  return JSON.parse(match[1]);
}

function tarEntries(compressed) {
  const tar = gunzipSync(compressed);
  const entries = [];
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const readText = (start, length) => header.subarray(start, start + length).toString("utf8").replace(/\0.*$/s, "");
    const readOctal = (start, length) => Number.parseInt(readText(start, length).trim() || "0", 8);
    const name = readText(0, 100);
    const prefix = readText(345, 155);
    const path = prefix ? `${prefix}/${name}` : name;
    const size = readOctal(124, 12);
    entries.push({
      path,
      mode: readOctal(100, 8),
      uid: readOctal(108, 8),
      gid: readOctal(116, 8),
      mtime: readOctal(136, 12),
      uname: readText(265, 32),
      gname: readText(297, 32),
      size,
    });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function jpegSize(bytes) {
  assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff], "Screenshot is not a JPEG file");
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) break;
    offset += 2 + length;
  }
  throw new Error("Screenshot JPEG dimensions are missing");
}

assert.equal(new Set(ROUTES).size, ROUTES.length, "Release routes must be unique");
assert.equal(ROUTES[0], "/", "Homepage must be the first release route");

const rootEntries = await readdir(outputRoot, { withFileTypes: true });
const routeDirectories = [...new Set(ROUTES.filter((route) => route !== "/").map((route) => route.slice(1).split("/")[0]))];
const expectedDirectories = [...routeDirectories, "assets", "engine", "icons", "legal", "ocr", "source"];
sameSet(rootEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name), expectedDirectories, "Static export directories differ from the release inventory");
sameSet(rootEntries.filter((entry) => entry.isFile()).map((entry) => entry.name), ROOT_EXPORT_FILES, "Static export root files differ from the release inventory");

sameSet(await readdir(join(outputRoot, "engine")), ENGINE_FILES, "Engine export inventory is not exact");
sameSet(await filesBelow(join(outputRoot, "ocr"), join(outputRoot, "ocr")), OCR_FILES, "OCR export inventory is not exact");
sameSet(await readdir(join(outputRoot, "icons")), ICON_FILES, "Icon export inventory is not exact");
sameSet(await readdir(join(outputRoot, "legal")), LEGAL_FILES, "Legal export inventory is not exact");
sameSet(await readdir(join(outputRoot, "source")), SOURCE_FILES, "Source export inventory is not exact");

const htmlByRoute = new Map();
const discoveredAssets = new Set();
for (const route of ROUTES) {
  const html = await readFile(routePath(route), "utf8");
  htmlByRoute.set(route, html);
  const title = firstMatch(html, /<title>([^<]+)<\/title>/i, `${route} title is missing`);
  const description = firstMatch(html, /<meta name="description" content="([^"]+)"/i, `${route} description is missing`);
  const canonical = firstMatch(html, /<link rel="canonical" href="([^"]+)"/i, `${route} canonical is missing`);
  const ogTitle = firstMatch(html, /<meta property="og:title" content="([^"]+)"/i, `${route} Open Graph title is missing`);
  const ogDescription = firstMatch(html, /<meta property="og:description" content="([^"]+)"/i, `${route} Open Graph description is missing`);
  const ogUrl = firstMatch(html, /<meta property="og:url" content="([^"]+)"/i, `${route} Open Graph URL is missing`);
  const expectedUrl = `${origin}${route === "/" ? "/" : route}`;
  assert.equal(canonical, expectedUrl, `${route} canonical is wrong`);
  assert.equal(ogUrl, expectedUrl, `${route} Open Graph URL is wrong`);
  assert.equal(ogTitle, title, `${route} Open Graph title differs from the document title`);
  assert.equal(ogDescription, description, `${route} Open Graph description differs from the document description`);
  assert.equal((html.match(/<h1(?:\s|>)/gi) ?? []).length, 1, `${route} must contain exactly one H1`);
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) discoveredAssets.add(match[1].slice(1).split("?")[0]);
}
assert.match(htmlByRoute.get("/") ?? "", /"@type":"WebSite"/, "Homepage WebSite structured data is missing");
assert.match(htmlByRoute.get("/") ?? "", /"@type":"WebApplication"/, "Homepage WebApplication structured data is missing");
for (const route of ROUTES.filter((route) => route !== "/")) {
  assert.doesNotMatch(htmlByRoute.get(route) ?? "", /"@type":"WebApplication"/, `${route} inherits homepage structured data`);
}

const manifest = JSON.parse(await readFile(clientManifestPath, "utf8"));
for (const value of Object.values(manifest)) {
  if (typeof value.file === "string" && value.file.startsWith("assets/")) discoveredAssets.add(value.file);
  for (const key of ["css", "assets"]) {
    for (const file of value[key] ?? []) if (file.startsWith("assets/")) discoveredAssets.add(file);
  }
}
const actualAssets = (await readdir(join(outputRoot, "assets"))).map((name) => `assets/${name}`);
sameSet(actualAssets, discoveredAssets, "Hashed asset export contains an unreferenced or missing file");

const sitemap = await readFile(join(outputRoot, "sitemap.xml"), "utf8");
const sitemapRoutes = [...sitemap.matchAll(/<loc>https:\/\/www\.snackpdf\.com([^<]*)<\/loc>/g)]
  .map((match) => match[1] || "/");
const sitemapExcludedRoutes = new Set(["/terms", "/cookies", "/open-source-licences"]);
sameSet(sitemapRoutes, ROUTES.filter((route) => !sitemapExcludedRoutes.has(route)), "Sitemap and prioritised landing routes differ");
const serviceWorker = await readFile(join(outputRoot, "service-worker.js"), "utf8");
sameSet(parseServiceWorkerRoutes(serviceWorker), ROUTES, "Service Worker and release routes differ");
assert.match(serviceWorker, /status: 404/, "Offline unknown routes must return 404");

const webManifest = JSON.parse(await readFile(join(outputRoot, "manifest.webmanifest"), "utf8"));
sameSet(webManifest.icons.map((icon) => icon.src), ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/app-icon.svg"], "Manifest icons differ from the canonical identity set");
assert.equal(webManifest.screenshots?.length, 1, "Manifest must expose one current homepage screenshot");
assert.equal(webManifest.screenshots[0].src, "/screenshot.jpeg");
assert.equal(webManifest.screenshots[0].sizes, "1200x675");
const openGraphImage = await readFile(join(outputRoot, "og.png"));
assert.deepEqual([...openGraphImage.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "Open Graph image is not a PNG file");
assert.deepEqual({ width: openGraphImage.readUInt32BE(16), height: openGraphImage.readUInt32BE(20) }, { width: 1200, height: 630 });
assert.deepEqual(jpegSize(await readFile(join(outputRoot, "screenshot.jpeg"))), { width: 1200, height: 675 });

const allExportFiles = await filesBelow(outputRoot);
for (const path of allExportFiles) {
  const name = basename(path);
  assert.notEqual(name, ".DS_Store", `Finder metadata entered the release: ${path}`);
  assert.doesNotMatch(path, /(?:^|\/)[^/]* 2(?:\.[^/]*)?$/, `Copied file entered the release: ${path}`);
  assert.doesNotMatch(path, /(?:^|\/)[^/]*-v2(?:\.[^/]*)?$/, `Legacy v2 alias entered the release: ${path}`);
  assert.doesNotMatch(path, /(?:^|\/)[^/]*(?:\.bak|\.orig|~)$/, `Backup file entered the release: ${path}`);
}
assert.equal(allExportFiles.filter((path) => path === "service-worker.js").length, 1);
assert.equal(allExportFiles.filter((path) => path === "engine/worker.js").length, 1);
assert.equal(allExportFiles.filter((path) => path === "engine/gs.wasm").length, 1);

const sourceArchive = await readFile(join(outputRoot, "source/snackpdf-source.tar.gz"));
const sourceChecksum = (await readFile(join(outputRoot, "source/snackpdf-source.tar.gz.sha256"), "utf8")).trim().split(/\s+/)[0];
assert.equal(createHash("sha256").update(sourceArchive).digest("hex"), sourceChecksum, "Source archive checksum is wrong");
const archived = tarEntries(sourceArchive);
assert.ok(archived.length > 30, "Source archive is unexpectedly small");
for (const entry of archived) {
  assert.equal(entry.uid, 0, `${entry.path} has a non-normalized owner`);
  assert.equal(entry.gid, 0, `${entry.path} has a non-normalized group`);
  assert.equal(entry.mtime, 0, `${entry.path} has a non-normalized timestamp`);
  assert.equal(entry.uname, "root", `${entry.path} has a non-normalized owner name`);
  assert.equal(entry.gname, "root", `${entry.path} has a non-normalized group name`);
  assert.doesNotMatch(entry.path, /\.DS_Store|(?:^|\/)[^/]* 2(?:\.[^/]*)?$|(?:^|\/)\.env(?:\.|$)/, `Forbidden source entry: ${entry.path}`);
}

const engineChecksums = JSON.parse(await readFile(join(outputRoot, "engine/checksums.json"), "utf8"));
for (const [name, expected] of Object.entries(engineChecksums.files)) {
  const bytes = await readFile(join(outputRoot, "engine", name));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, `Engine checksum differs for ${name}`);
}

const robots = await readFile(join(outputRoot, "robots.txt"), "utf8");
assert.match(robots, /^Disallow: \/engine\/$/m, "The large engine crawl exclusion is missing");
assert.doesNotMatch(robots, /^Disallow: \/(?:source|legal)\/$/m, "Header-noindexed source and legal files must remain crawlable");

console.log(`Release inventory passed: ${ROUTES.length} routes, ${allExportFiles.length} files, ${archived.length} normalized source files.`);
