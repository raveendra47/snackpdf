/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: Fetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "accelerometer=(), bluetooth=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

const CANONICAL_ORIGIN = "https://www.snackpdf.com";
const LEGACY_REDIRECTS = new Map([
  ["/compress", "/compress-pdf"],
  ["/compress/", "/compress-pdf"],
]);

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

function isViteDevelopmentRequest(url: URL): boolean {
  if (!isLocalHost(url.hostname)) return false;
  return ["/@id/", "/@fs/", "/@vite/", "/@react-refresh"].some((prefix) => url.pathname.startsWith(prefix));
}

function secure(response: Response, url: URL): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  if (url.pathname.startsWith("/engine/") || url.pathname.startsWith("/ocr/") || url.pathname.startsWith("/source/") || url.pathname.startsWith("/legal/")) {
    headers.set("X-Robots-Tag", "noindex, nofollow, nosnippet");
  }
  if ((headers.get("content-type") ?? "").includes("text/html") && url.hostname !== "www.snackpdf.com" && !isLocalHost(url.hostname)) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  if (url.pathname === "/service-worker.js") {
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.set("Service-Worker-Allowed", "/");
  } else if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/assets/")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (url.pathname.startsWith("/engine/") || url.pathname.startsWith("/ocr/") || url.pathname.startsWith("/source/") || url.pathname.startsWith("/legal/")) {
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  } else if ((headers.get("content-type") ?? "").includes("text/html")) {
    // Revalidate HTML at browsers and shared caches; hashed assets stay immutable.
    headers.set("Cache-Control", "no-cache, must-revalidate");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // The Cloudflare worker runs in front of Vite during local development.
    // Let Vite resolve its virtual client modules instead of treating them as
    // application routes; otherwise the server-rendered page cannot hydrate.
    if (isViteDevelopmentRequest(url)) return env.ASSETS.fetch(request);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return secure(new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD", "Content-Type": "text/plain;charset=utf-8" },
      }), url);
    }

    if (url.hostname === "snackpdf.com" || (url.hostname === "www.snackpdf.com" && url.protocol !== "https:")) {
      const canonical = new URL(CANONICAL_ORIGIN);
      canonical.pathname = url.pathname;
      canonical.search = url.search;
      return secure(new Response(null, { status: 308, headers: { Location: canonical.href } }), url);
    }

    const legacyDestination = LEGACY_REDIRECTS.get(url.pathname);
    if (legacyDestination) {
      const destination = new URL(legacyDestination, CANONICAL_ORIGIN);
      destination.search = url.search;
      return secure(new Response(null, { status: 308, headers: { Location: destination.href } }), url);
    }

    if (url.pathname === "/_headers") {
      return secure(new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain;charset=utf-8" } }), url);
    }

    if (url.pathname.includes(".")) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) return secure(asset, url);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return secure(response, url);
    }

    return secure(await handler.fetch(request, env, ctx), url);
  },
};

export default worker;
