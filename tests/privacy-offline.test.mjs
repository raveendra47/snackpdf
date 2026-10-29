import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { ROUTES as routes } from "../config/release-inventory.mjs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the production client has no document telemetry or persistent document storage", () => {
  const clientSource = [
    read("app/components/tool-app.tsx"),
    read("app/components/ocr-tool-app.tsx"),
    read("app/components/redaction-tool-app.tsx"),
    read("app/components/form-tool-app.tsx"),
    read("app/components/protect-tool-app.tsx"),
    read("app/lib/pdf-encrypt.ts"),
    read("app/lib/engine-client.ts"),
    read("src/engine/worker.ts"),
    read("public/service-worker.js"),
  ].join("\n");

  for (const forbidden of [
    "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon", "FormData",
    "localStorage", "sessionStorage", "indexedDB", "IDBFS", "document.cookie",
    "google-analytics", "googletagmanager", "sentry", "posthog", "mixpanel",
  ]) {
    assert.equal(clientSource.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }

  const worker = read("src/engine/worker.ts");
  assert.match(worker, /fetch\("\/engine\/gs\.wasm"/);
  assert.doesNotMatch(worker, /https?:\/\//);

  const bridge = read("app/lib/engine-client.ts");
  assert.match(bridge, /postMessage\([^\n]+, transfer\)/);
  assert.match(bridge, /new Worker\("\/engine\/worker\.js"/);
});

test("the offline cache contains every route and the complete local engine", () => {
  const serviceWorker = read("public/service-worker.js");
  for (const route of routes) assert.match(serviceWorker, new RegExp(`\\"${route.replaceAll("/", "\\/")}\\"`));
  for (const asset of ["/engine/worker.js", "/engine/gs.js", "/engine/gs.wasm", "/ocr/worker.min.js", "/ocr/pdf.worker.min.mjs", "/ocr/core/tesseract-core-lstm.wasm.js", "/ocr/core/tesseract-core-simd-lstm.wasm.js", "/ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js", "/ocr/lang/eng.traineddata.gz", "/manifest.webmanifest", "/snackpdf-sample.pdf"]) {
    assert.match(serviceWorker, new RegExp(asset.replaceAll("/", "\\/")));
  }
  assert.match(serviceWorker, /request\.method !== "GET"/);
  assert.match(serviceWorker, /url\.origin !== self\.location\.origin/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/assets\/"\)/);
  assert.match(serviceWorker, /READY_KEY/);
  const fetchHandler = serviceWorker.slice(serviceWorker.indexOf('self.addEventListener("fetch"'));
  assert.doesNotMatch(fetchHandler, /cache\.put/);

  for (const route of routes) {
    const relative = route === "/" ? "static-site/index.html" : `static-site${route}/index.html`;
    assert.equal(existsSync(new URL(`../${relative}`, import.meta.url)), true, relative);
  }
  for (const asset of ["static-site/engine/worker.js", "static-site/engine/gs.wasm", "static-site/service-worker.js", "static-site/snackpdf-sample.pdf", "static-site/source/snackpdf-source.tar.gz", "static-site/source/snackpdf-source.tar.gz.sha256"]) {
    assert.equal(existsSync(new URL(`../${asset}`, import.meta.url)), true, asset);
  }
});

test("the server policy allows only same-origin connections and rejects writes", () => {
  const worker = read("worker/index.ts");
  assert.match(worker, /connect-src 'self'/);
  assert.match(worker, /form-action 'none'/);
  assert.match(worker, /frame-ancestors 'none'/);
  assert.match(worker, /method !== "GET" && request\.method !== "HEAD"/);
});
