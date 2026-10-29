import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("offline releases are content-versioned, complete and immutable while active", () => {
  const serviceWorker = read("public/service-worker.js");
  assert.match(serviceWorker, /const CACHE_VERSION = "snackpdf-[a-f0-9]{20}";/);
  assert.match(serviceWorker, /READY_KEY/);
  assert.match(serviceWorker, /CACHE_STATUS/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/assets\/"\)/);
  assert.doesNotMatch(serviceWorker, /cdn-cgi/);
  const fetchHandler = serviceWorker.slice(serviceWorker.indexOf('self.addEventListener("fetch"'));
  assert.doesNotMatch(fetchHandler, /cache\.put/);
  assert.match(read("scripts/build-verified.sh"), /version-service-worker\.mjs/);
  assert.match(serviceWorker, /"\/screenshot\.jpeg"/);
  assert.match(serviceWorker, /new Response\("Not found", \{ status: 404/);
  assert.doesNotMatch(read("scripts/version-service-worker.mjs"), /endsWith\("\/public\/screenshot\.jpeg"\)/);
});

test("updates cannot reload an active job and installation stays optional", () => {
  const registration = read("app/components/service-worker-registration.tsx");
  const tool = read("app/components/tool-app.tsx");
  assert.match(registration, /beforeinstallprompt/);
  assert.match(registration, /Install SnackPDF/);
  assert.match(registration, /optional\. It also works in this browser/);
  assert.match(registration, /addEventListener\("load"/);
  assert.match(registration, /document\.readyState === "complete"/);
  assert.match(registration, /jobActive/);
  assert.match(registration, /disabled=\{jobActive \|\| !isOnline\}/);
  assert.match(tool, /snackpdf:job-state/);
  assert.match(tool, /operationRef/);
  assert.match(tool, /engine\.cancel\(\)/);
});

test("the Worker protocol has no no-op cleanup request", () => {
  const types = read("src/engine/types.ts");
  const worker = read("src/engine/worker.ts");
  assert.doesNotMatch(types, /"clean"|"cleaned"/);
  assert.doesNotMatch(worker, /request\.type === "clean"/);
  assert.match(worker, /pageAreaSquarePoints/);
});

test("shared tool completion and saving contracts are explicit", () => {
  const tool = read("app/components/tool-app.tsx");
  for (const phrase of [
    "Interpreted sequence:", "Final order:", "Expected output:",
    "Creating output", "Action:", "Output:", "Filename:", "Type:", "Size:",
    "Original size:", "Result size:", "Bytes saved:", "Percentage saved:",
    "Download {result.name}", "Start again",
    "Save all to a folder", "The password was cleared after processing.",
  ]) assert.ok(tool.includes(phrase), phrase);
  assert.match(tool, /result\.typeLabel/);
  assert.match(tool, /result\.pageCount/);
  assert.match(tool, /showDirectoryPicker/);
  assert.match(tool, /300 DPI uses substantially more memory/);
});

test("compress keeps a visible post-processing download control for the index instrument", () => {
  const tool = read("app/components/tool-app.tsx");
  assert.match(tool, /className="download-link"/);
  assert.match(tool, /Download \{result\.name\}/);
  assert.doesNotMatch(tool, /window\.location(?:\.href|\.assign)|result\.url[\s\S]{0,80}\.click\(\)/);
});

test("static HTML is cacheable at the edge while browsers revalidate promptly", () => {
  const worker = read("worker/index.ts");
  assert.match(worker, /no-cache, must-revalidate/);
});

test("production metadata, GPT Sites hosting and legal materials match the live www origin", () => {
  const layout = read("app/layout.tsx");
  const siteConfig = read("app/lib/site-config.ts");
  const hosting = JSON.parse(read(".openai/hosting.json"));
  const worker = read("worker/index.ts");
  assert.match(siteConfig, /https:\/\/www\.snackpdf\.com/);
  assert.equal(hosting.project_id, "appgprj_6a886ed798748191b1afdbcac6815870");
  assert.doesNotMatch(layout, /"offers"/);
  const robots = read("public/robots.txt");
  assert.match(robots, /www\.snackpdf\.com\/sitemap\.xml/);
  assert.match(robots, /^Disallow: \/engine\/$/m);
  assert.doesNotMatch(robots, /^Disallow: \/(?:source|legal)\/$/m);
  assert.doesNotMatch(read("public/sitemap.xml"), /https:\/\/snackpdf\.com/);
  assert.match(read("public/sitemap.xml"), /www\.snackpdf\.com\/about/);
  assert.match(worker, /method !== "GET" && request\.method !== "HEAD"/);
  assert.match(worker, /X-Robots-Tag/);
  assert.match(read("vite.config.ts"), /run_worker_first: true/);
  assert.match(worker, /url\.pathname === "\/_headers"/);
  assert.equal(existsSync(new URL("../public/legal/RUNTIME-MIT-NOTICES.txt", import.meta.url)), true);
  assert.equal(existsSync(new URL("../public/legal/PDF-ENCRYPT-MIT.txt", import.meta.url)), true);
  assert.match(read("app/components/legal-page.tsx"), /PDF-ENCRYPT-MIT\.txt/);
  assert.match(read("scripts/build-verified.sh"), /RUNTIME-MIT-NOTICES\.txt/);
  assert.match(read("scripts/build-verified.sh"), /assert-release-inventory\.mjs/);
  assert.match(read("scripts/build-source-archive.mjs"), /createHash\("sha256"\)/);
  assert.match(read("scripts/build-source-archive.mjs"), /uid|writeOctal/);
  assert.match(read("app/components/legal-page.tsx"), /snackpdf-source\.tar\.gz\.sha256/);
  assert.equal(existsSync(new URL("../public/_headers", import.meta.url)), false);
});

test("one canonical identity set and dormant voluntary support are enforced", () => {
  for (const removed of [
    "public/manifest-v2.webmanifest", "public/favicon-v2.ico", "public/favicon-v2.svg",
    "public/apple-touch-icon-v2.png", "public/icons/app-icon-v2.svg",
    "public/icons/icon-192-v2.png", "public/icons/icon-512-v2.png",
    "public/icons/favicon-32-v2.png", "public/icons/apple-touch-icon.png",
  ]) assert.equal(existsSync(new URL(`../${removed}`, import.meta.url)), false, removed);
  const frame = read("app/components/site-frame.tsx");
  assert.match(frame, /Support SnackPDF/);
  assert.match(frame, /href="\/support"/);
  const legal = read("app/components/legal-page.tsx");
  assert.match(legal, /external noopener noreferrer/);
  assert.match(legal, /https:\/\/buymeacoffee\.com\/calumkerr/);
  assert.match(read("app/lib/site-config.ts"), /supportUrl: null/);
});
