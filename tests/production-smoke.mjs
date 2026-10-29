import assert from "node:assert/strict";
import { ROUTES } from "../config/release-inventory.mjs";

const origin = "https://www.snackpdf.com";
const apex = "https://snackpdf.com";
const sitesUrl = process.env.SNACKPDF_SITES_URL?.replace(/\/$/, "");

async function request(url, options = {}) {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
    ...options,
  });
  return response;
}

function header(response, name) {
  const value = response.headers.get(name);
  assert.ok(value, `${response.url || "Response"} is missing ${name}`);
  return value;
}

for (const route of ROUTES) {
  const response = await request(`${origin}${route}`);
  assert.equal(response.status, 200, `${route} did not return 200`);
  const html = await response.text();
  assert.match(header(response, "content-type"), /^text\/html\b/i);
  assert.match(html, new RegExp(`<link rel="canonical" href="${origin.replaceAll(".", "\\.")}${route === "/" ? "\/" : route}"`));
  assert.match(header(response, "content-security-policy"), /object-src 'none'/);
  assert.equal(header(response, "x-content-type-options"), "nosniff");
}

const apexPath = "/merge-pdf?smoke=1";
const apexResponse = await request(`${apex}${apexPath}`);
assert.ok([301, 308].includes(apexResponse.status), `Apex deep link returned ${apexResponse.status}`);
assert.equal(apexResponse.headers.get("location"), `${origin}${apexPath}`);

const httpWww = await request("http://www.snackpdf.com/pdf-to-jpg?smoke=1");
assert.ok([301, 308].includes(httpWww.status), `HTTP www redirect returned ${httpWww.status}`);
assert.equal(httpWww.headers.get("location"), `${origin}/pdf-to-jpg?smoke=1`);

const trailingSlash = await request(`${origin}/merge-pdf/`);
assert.ok([301, 308].includes(trailingSlash.status));
assert.equal(trailingSlash.headers.get("location"), `${origin}/merge-pdf`);

assert.equal((await request(`${origin}/Merge-PDF`)).status, 404);
assert.equal((await request(`${origin}/not-a-snackpdf-route`)).status, 404);

const queryResponse = await request(`${origin}/compress-pdf?utm_source=smoke`);
assert.equal(queryResponse.status, 200);
assert.match(await queryResponse.text(), /<link rel="canonical" href="https:\/\/www\.snackpdf\.com\/compress-pdf"/);

const homepage = await (await request(`${origin}/`)).text();
const assetPath = homepage.match(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/)?.[1];
assert.ok(assetPath, "No hashed runtime asset was found");
const asset = await request(`${origin}${assetPath}`);
assert.equal(asset.status, 200);
assert.match(header(asset, "cache-control"), /max-age=31536000/);
assert.match(header(asset, "cache-control"), /immutable/);

const serviceWorker = await request(`${origin}/service-worker.js`);
assert.equal(serviceWorker.status, 200);
assert.match(header(serviceWorker, "cache-control"), /no-store/);
assert.equal(header(serviceWorker, "service-worker-allowed"), "/");

for (const path of ["/source/snackpdf-source.tar.gz.sha256", "/legal/AGPL-3.0.txt", "/legal/PDF-ENCRYPT-MIT.txt"]) {
  const response = await request(`${origin}${path}`);
  assert.equal(response.status, 200);
  assert.match(header(response, "x-robots-tag"), /noindex/);
}

const wasm = await request(`${origin}/engine/gs.wasm`, { method: "HEAD" });
assert.equal(wasm.status, 200);
assert.equal(header(wasm, "content-type"), "application/wasm");
assert.match(header(wasm, "x-robots-tag"), /noindex/);

if (sitesUrl) {
  const deploymentHost = await request(`${sitesUrl}/compress-pdf`);
  assert.ok([200, 301, 302, 307, 308].includes(deploymentHost.status));
  if (deploymentHost.status === 200) {
    assert.match(header(deploymentHost, "x-robots-tag"), /noindex/);
  } else {
    assert.match(header(deploymentHost, "location"), /^https:\/\/www\.snackpdf\.com\/compress-pdf/);
  }
}

console.log(`Production smoke checks passed for ${ROUTES.length} canonical routes.`);
