import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../static-site/", import.meta.url));
const port = Number(process.env.SNACKPDF_TEST_PORT ?? 4173);
const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "accelerometer=(), bluetooth=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const contentTypes = {
  ".css": "text/css;charset=utf-8",
  ".gz": "application/gzip",
  ".html": "text/html;charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".js": "text/javascript;charset=utf-8",
  ".mjs": "text/javascript;charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain;charset=utf-8",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml;charset=utf-8",
};

async function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = normalize(decoded).replace(/^[/\\]+/, "");
  if (relative.startsWith("..")) return null;
  const candidates = decoded.endsWith("/")
    ? [join(root, relative, "index.html")]
    : [join(root, relative), join(root, relative, "index.html")];
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Try the next exact static path.
    }
  }
  return null;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value);
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain;charset=utf-8" });
    response.end("Method not allowed");
    return;
  }
  if (url.pathname === "/_headers") {
    response.writeHead(404, { "Content-Type": "text/plain;charset=utf-8" });
    response.end("Not found");
    return;
  }
  const file = await resolveFile(url.pathname);
  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain;charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.setHeader("Content-Type", contentTypes[extname(file)] ?? "application/octet-stream");
  if (url.pathname.startsWith("/engine/") || url.pathname.startsWith("/ocr/") || url.pathname.startsWith("/source/") || url.pathname.startsWith("/legal/")) {
    response.setHeader("X-Robots-Tag", "noindex, nofollow, nosnippet");
  }
  if (url.pathname === "/service-worker.js") {
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    response.setHeader("Service-Worker-Allowed", "/");
  } else if (url.pathname.startsWith("/assets/")) {
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  }
  response.writeHead(200);
  if (request.method === "HEAD") response.end();
  else createReadStream(file).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`SnackPDF static test server: http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
