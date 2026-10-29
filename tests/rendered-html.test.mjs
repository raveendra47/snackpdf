import assert from "node:assert/strict";
import test from "node:test";

async function request(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`https://www.snackpdf.com${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the finished homepage and security headers", async () => {
  const response = await request("/");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(response.headers.get("content-security-policy") ?? "", /object-src 'none'/);
  assert.match(html, /<title>Private PDF Tools That Work Offline \| SnackPDF<\/title>/i);
  assert.match(html, /What do you need to do\?/);
  assert.match(html, /All PDF tools/i);
  assert.match(html, /Your PDFs stay on this device/);
  assert.match(html, /Processed locally/);
  assert.match(html, /Available offline/);
  assert.match(html, /href="\/compress-pdf"/);
  assert.match(html, /href="\/support"/);
  assert.match(html, /"@type":"WebSite"/);
  assert.match(html, /"@type":"WebApplication"/);
  assert.match(html, /"@type":"ItemList"/);
  assert.doesNotMatch(html, /buymeacoffee\.com/);
  assert.doesNotMatch(html, /Starter Project|codex-preview/);
});

test("renders a real tool route and legal route", async () => {
  const tool = await request("/compress-pdf");
  const toolHtml = await tool.text();
  assert.equal(tool.status, 200);
  assert.match(toolHtml, /<h1[^>]*>Compress PDF<\/h1>/);
  assert.match(toolHtml, /Choose PDF/);
  assert.match(toolHtml, /Choose the compression trade-off/);
  assert.match(toolHtml, /Related tools/);
  assert.match(toolHtml, /"@type":"BreadcrumbList"/);

  const privacy = await request("/privacy");
  const privacyHtml = await privacy.text();
  assert.equal(privacy.status, 200);
  assert.match(privacyHtml, /Documents are not intentionally transferred/);
  assert.match(privacyHtml, /property="og:url" content="https:\/\/www\.snackpdf\.com\/privacy"/);
  assert.doesNotMatch(privacyHtml, /"@type":"WebApplication"/);

  const about = await request("/about");
  const aboutHtml = await about.text();
  assert.equal(about.status, 200);
  assert.match(aboutHtml, /Older third-party descriptions may refer to previous or experimental versions/);
  assert.match(aboutHtml, /authoritative current product description/);
  assert.match(aboutHtml, /maintained as an independent project/);
  assert.match(aboutHtml, /https:\/\/buymeacoffee\.com\/calumkerr"/);
  assert.match(aboutHtml, /https:\/\/buymeacoffee\.com\/calumkerr\/e\/569210"/);
  assert.match(aboutHtml, /These external pages require an internet connection/);

  const testing = await request("/how-snackpdf-is-tested");
  const testingHtml = await testing.text();
  assert.equal(testing.status, 200);
  assert.match(testingHtml, /Last verified:/);
  assert.match(testingHtml, /Network and storage inspection/);
  assert.match(testingHtml, /15,533,045 bytes/);
});

test("unknown routes and raw header configuration are not public documents", async () => {
  const unknown = await request("/not-a-snackpdf-route");
  assert.equal(unknown.status, 404);
  const headersFile = await request("/_headers");
  assert.equal(headersFile.status, 404);
});

test("rejects unsupported write methods", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("methods", String(Date.now()));
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("https://snackpdf.com/", { method: "POST" }),
    {},
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
});

test("canonical hosts redirect permanently and deployment hosts stay out of the index", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("hosts", String(Date.now()));
  const { default: worker } = await import(workerUrl.href);
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  const apex = await worker.fetch(new Request("https://snackpdf.com/merge-pdf?order=1"), env, ctx);
  assert.equal(apex.status, 308);
  assert.equal(apex.headers.get("location"), "https://www.snackpdf.com/merge-pdf?order=1");

  const httpWww = await worker.fetch(new Request("http://www.snackpdf.com/pdf-to-jpg"), env, ctx);
  assert.equal(httpWww.status, 308);
  assert.equal(httpWww.headers.get("location"), "https://www.snackpdf.com/pdf-to-jpg");

  const deploymentHost = await worker.fetch(new Request("https://snackpdf.example.chatgpt.site/compress-pdf"), env, ctx);
  assert.equal(deploymentHost.status, 200);
  assert.equal(deploymentHost.headers.get("x-robots-tag"), "noindex, nofollow");
});

test("every genuine legacy tool URL redirects permanently and preserves queries", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("legacy", String(Date.now()));
  const { default: worker } = await import(workerUrl.href);
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  for (const path of ["/compress", "/compress/"]) {
    const response = await worker.fetch(new Request(`https://www.snackpdf.com${path}?profile=smallest&source=old`), env, ctx);
    assert.equal(response.status, 308, path);
    assert.equal(response.headers.get("location"), "https://www.snackpdf.com/compress-pdf?profile=smallest&source=old", path);
  }

  const invalid = await worker.fetch(new Request("https://www.snackpdf.com/compress-invalid"), env, ctx);
  assert.equal(invalid.status, 404);
  assert.equal(invalid.headers.has("location"), false);
});

test("raw public resources receive live indexing and cache headers", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("assets", String(Date.now()));
  const { default: worker } = await import(workerUrl.href);
  const env = {
    ASSETS: {
      fetch: async (assetRequest) => new Response("fixture", {
        status: 200,
        headers: { "Content-Type": new URL(assetRequest.url).pathname.endsWith(".wasm") ? "application/wasm" : "text/plain" },
      }),
    },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  const source = await worker.fetch(new Request("https://www.snackpdf.com/source/checksum.txt"), env, ctx);
  assert.match(source.headers.get("x-robots-tag") ?? "", /noindex/);
  assert.equal(await source.text(), "fixture");

  const serviceWorker = await worker.fetch(new Request("https://www.snackpdf.com/service-worker.js"), env, ctx);
  assert.match(serviceWorker.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(serviceWorker.headers.get("service-worker-allowed"), "/");
});

test("local Vite client modules bypass the application router", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("vite-development", String(Date.now()));
  const { default: worker } = await import(workerUrl.href);
  const requested = [];
  const env = {
    ASSETS: {
      fetch: async (assetRequest) => {
        requested.push(new URL(assetRequest.url).pathname);
        return new Response("export const hydrated = true;", {
          headers: { "Content-Type": "text/javascript;charset=utf-8" },
        });
      },
    },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  const response = await worker.fetch(
    new Request("http://127.0.0.1:5174/@id/__x00__virtual:vite-rsc/entry-browser"),
    env,
    ctx,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(requested, ["/@id/__x00__virtual:vite-rsc/entry-browser"]);
  assert.match(await response.text(), /hydrated = true/);
});
