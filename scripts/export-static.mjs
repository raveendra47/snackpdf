import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { ROUTES as routes } from "../config/release-inventory.mjs";

const clientRoot = new URL("../dist/client/", import.meta.url);
const outputRoot = new URL("../static-site/", import.meta.url);
const serverUrl = new URL("../dist/server/index.js", import.meta.url);
serverUrl.searchParams.set("static-export", String(Date.now()));
const { default: worker } = await import(serverUrl.href);

if (new Set(routes).size !== routes.length) throw new Error("Release route inventory contains a duplicate route.");

function contentType(pathname) {
  const extension = pathname.split(".").pop()?.toLowerCase();
  return ({
    css: "text/css;charset=utf-8",
    html: "text/html;charset=utf-8",
    ico: "image/x-icon",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    js: "text/javascript;charset=utf-8",
    mjs: "text/javascript;charset=utf-8",
    json: "application/json",
    png: "image/png",
    svg: "image/svg+xml",
    txt: "text/plain;charset=utf-8",
    wasm: "application/wasm",
    webmanifest: "application/manifest+json",
    xml: "application/xml;charset=utf-8",
    gz: "application/gzip",
  })[extension] ?? "application/octet-stream";
}

const env = {
  ASSETS: {
    async fetch(request) {
      const pathname = new URL(request.url).pathname.replace(/^\/+/, "");
      try {
        const bytes = await readFile(new URL(pathname, clientRoot));
        return new Response(bytes, { status: 200, headers: { "Content-Type": contentType(pathname) } });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    },
  },
};

const ctx = { waitUntil() {}, passThroughOnException() {} };
const deploymentVersionPattern = /(deploymentVersion\\?":\\?")[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await cp(clientRoot, outputRoot, { recursive: true, force: true });
await rm(new URL(".vite/", outputRoot), { recursive: true, force: true });
await rm(new URL(".assetsignore", outputRoot), { force: true });
await rm(new URL("_headers", outputRoot), { force: true });

for (const route of routes) {
  const response = await worker.fetch(
    new Request(`https://www.snackpdf.com${route}`, { headers: { Accept: "text/html" } }),
    env,
    ctx,
  );
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.includes("text/html")) {
    throw new Error(`Static export failed for ${route}: ${response.status} ${type}`);
  }
  const directory = route === "/" ? outputRoot : new URL(`.${route}/`, outputRoot);
  await mkdir(directory, { recursive: true });
  const html = (await response.text()).replace(
    deploymentVersionPattern,
    (_match, prefix) => `${prefix}00000000-0000-0000-0000-000000000000`,
  );
  await writeFile(new URL("index.html", directory), html);
}

await writeFile(new URL(".static-export-complete", outputRoot), "SnackPDF static export complete\n");
