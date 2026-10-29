const CACHE_VERSION = "snackpdf-e9e7896b560fb9938aa5";
const READY_KEY = "/__snackpdf-cache-ready__";
const ROUTES = [
  "/", "/compress-pdf", "/rebuild-pdf", "/grayscale-pdf", "/merge-pdf",
  "/split-pdf", "/extract-pages", "/remove-pages", "/reorder-pages",
  "/pdf-to-jpg", "/pdf-to-png", "/pdf-to-text", "/ocr-pdf", "/redact-pdf", "/fill-pdf-form", "/protect-pdf", "/unlock-pdf",
  "/about", "/privacy", "/terms", "/cookies", "/open-source-licences", "/offline-use",
  "/how-snackpdf-is-tested",
  "/guides/compress-pdf-without-uploading",
  "/guides/verify-local-pdf-processing",
  "/guides/use-pdf-tools-offline",
  "/support"
];
const CORE = [
  ...ROUTES,
  "/favicon.svg", "/favicon.ico", "/icons/favicon-16.png", "/icons/favicon-32.png",
  "/apple-touch-icon.png", "/icons/safari-pinned-tab.svg",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/app-icon.svg",
  "/manifest.webmanifest", "/og.png", "/screenshot.jpeg", "/robots.txt", "/sitemap.xml",
  "/snackpdf-sample.pdf",
  "/engine/worker.js", "/engine/gs.js", "/engine/gs.wasm", "/engine/checksums.json",
  "/ocr/worker.min.js", "/ocr/pdf.worker.min.mjs",
  "/ocr/core/tesseract-core-lstm.wasm.js", "/ocr/core/tesseract-core-simd-lstm.wasm.js",
  "/ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js", "/ocr/lang/eng.traineddata.gz",
  "/legal/AGPL-3.0.txt", "/legal/GHOSTSCRIPT-AGPL-3.0.txt", "/legal/PDF-ENCRYPT-MIT.txt", "/legal/RUNTIME-MIT-NOTICES.txt"
];

async function fetchRequired(path) {
  // Cache Storage is the durable offline copy. Bypass the HTTP cache during
  // installation so a first tool job cannot race the same large WASM write.
  const response = await fetch(new Request(path, { cache: "no-store", credentials: "same-origin" }));
  if (!response.ok) throw new Error(`Could not cache ${path}`);
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_VERSION);
      const discovered = new Set(CORE);
      const routeResponses = new Map();
      for (const route of ROUTES) {
        const response = await fetchRequired(route);
        routeResponses.set(route, response);
        const html = await response.clone().text();
        for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
          const url = new URL(match[1], self.location.origin);
          if (url.origin === self.location.origin && url.pathname.startsWith("/assets/")) {
            discovered.add(url.pathname + url.search);
          }
        }
      }
      for (const [route, response] of routeResponses) await cache.put(route, response);
      for (const path of discovered) {
        if (routeResponses.has(path)) continue;
        await cache.put(path, await fetchRequired(path));
      }
      await cache.put(READY_KEY, new Response(CACHE_VERSION, {
        headers: { "Content-Type": "text/plain;charset=utf-8" },
      }));
    } catch (error) {
      await caches.delete(CACHE_VERSION);
      throw error;
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("snackpdf-") && name !== CACHE_VERSION).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (event.data?.type === "CACHE_STATUS") {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_VERSION);
      const ready = Boolean(await cache.match(READY_KEY));
      event.ports[0]?.postMessage({ type: "CACHE_STATUS", ready, version: CACHE_VERSION });
    })());
  }
});

function routeKey(pathname) {
  if (pathname === "/") return pathname;
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      // Do not rely on Safari exposing a special hard-reload cache mode.
      // Every online navigation checks the network without the HTTP cache.
      // Keep the installed release cache intact for consistent offline use.
      if (self.navigator.onLine === false) {
        const cached = await cache.match(routeKey(url.pathname));
        if (cached) return cached;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      try {
        return await fetch(new Request(request, { cache: "no-store", signal: controller.signal }));
      } catch {
        const cached = await cache.match(routeKey(url.pathname));
        if (cached) return cached;
        return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain;charset=utf-8" } });
      } finally {
        clearTimeout(timeout);
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // Honor explicit browser/fetch cache bypasses for scripts and other assets.
    if (["reload", "no-cache", "no-store"].includes(request.cache)) {
      try {
        return await fetch(request);
      } catch {
        // A hard reload must still be usable when the connection is unavailable.
      }
    }
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) return cached;
    return fetch(request);
  })());
});
