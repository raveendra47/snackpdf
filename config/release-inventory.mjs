export const ROUTES = Object.freeze([
  "/",
  "/compress-pdf",
  "/rebuild-pdf",
  "/grayscale-pdf",
  "/merge-pdf",
  "/split-pdf",
  "/extract-pages",
  "/remove-pages",
  "/reorder-pages",
  "/pdf-to-jpg",
  "/pdf-to-png",
  "/pdf-to-text",
  "/ocr-pdf",
  "/redact-pdf",
  "/fill-pdf-form",
  "/protect-pdf",
  "/unlock-pdf",
  "/about",
  "/privacy",
  "/terms",
  "/cookies",
  "/open-source-licences",
  "/offline-use",
  "/how-snackpdf-is-tested",
  "/guides/compress-pdf-without-uploading",
  "/guides/verify-local-pdf-processing",
  "/guides/use-pdf-tools-offline",
  "/support",
]);

export const ROOT_EXPORT_FILES = Object.freeze([
  ".static-export-complete",
  "apple-touch-icon.png",
  "favicon.ico",
  "favicon.svg",
  "index.html",
  "manifest.webmanifest",
  "og.png",
  "robots.txt",
  "screenshot.jpeg",
  "service-worker.js",
  "sitemap.xml",
  "snackpdf-sample.pdf",
]);

export const ENGINE_FILES = Object.freeze([
  "checksums.json",
  "commands.js",
  "errors.js",
  "gs.js",
  "gs.wasm",
  "worker.js",
]);

export const OCR_FILES = Object.freeze([
  "core/tesseract-core-lstm.wasm.js",
  "core/tesseract-core-relaxedsimd-lstm.wasm.js",
  "core/tesseract-core-simd-lstm.wasm.js",
  "lang/eng.traineddata.gz",
  "pdf.worker.min.mjs",
  "worker.min.js",
]);

export const ICON_FILES = Object.freeze([
  "app-icon.svg",
  "favicon-16.png",
  "favicon-32.png",
  "icon-192.png",
  "icon-512.png",
  "safari-pinned-tab.svg",
]);

export const LEGAL_FILES = Object.freeze([
  "AGPL-3.0.txt",
  "GHOSTSCRIPT-AGPL-3.0.txt",
  "PDF-ENCRYPT-MIT.txt",
  "RUNTIME-MIT-NOTICES.txt",
]);

export const SOURCE_FILES = Object.freeze([
  "snackpdf-source.tar.gz",
  "snackpdf-source.tar.gz.sha256",
]);
