# SnackPDF

SnackPDF is a deliberately simple collection of PDF tools. A user chooses a file, processes it inside the browser and saves the result. Documents are never sent to a processing server.

The current release includes:

- compress PDF with light, balanced and smallest profiles;
- rebuild and grayscale PDF;
- merge, split, extract, remove and reorder pages;
- PDF to JPG, PNG and plain text;
- OCR printed English text from scanned PDFs;
- permanently redact selected pages by rasterising them;
- fill existing AcroForm fields or place static marks on flat PDFs;
- password-protect a PDF with browser-local AES-256 encryption;
- unlock a PDF when the user knows the password.

There are no accounts, subscriptions, databases, analytics, cookies, advertisements or server-side PDF operations.

## Architecture

The user interface is built with TypeScript, semantic HTML and plain CSS in the existing Sites/Vinext checkout. The document engine is a dedicated Web Worker. It loads the locally hosted WebAssembly binary, writes deterministic internal filenames into an in-memory virtual filesystem and uses only hard-coded argument templates.

The hosted worker serves application pages and security headers only. It rejects write methods and has no document endpoint. `npm run build` also creates `static-site/`, an asserted static export containing only the intended routes and application assets.

User files are never written to localStorage, IndexedDB, Cache Storage or a real filesystem. Cache Storage contains application files only.

## Prerequisites

- Node.js 22.13 or newer
- npm with lockfile support
- GNU `timeout`, `flock`, `sha256sum` and `tar`
- ImageMagick only when regenerating PNG application icons
- Docker and Git only when reproducing the WebAssembly engine from source

## Local development

Install the pinned dependencies:

```sh
npm ci
npm run build:engine-assets
npm run dev
```

Open the local address printed by the development server. Document processing runs in the browser Worker, not in Node.

## Processing engine

The production dependency is pinned to `@okathira/ghostpdl-wasm@1.1.0`. It contains Ghostscript 10.06.0 built with Emscripten. Runtime files are copied into `public/engine/`; no CDN is used.

Verify the installed binary:

```sh
./scripts/verify-engine.sh
```

Reproduce it from the exact upstream source commit and build environment:

```sh
./scripts/build-engine.sh
```

The expected SHA-256 values are stored in `engine/checksums/ghostpdl-wasm-1.1.0.sha256`. The exact build source commit, GhostPDL submodule and Emscripten version are recorded in `engine/build/README.md` and `THIRD_PARTY_NOTICES.md`.

## Licence mode

This checkout is intentionally configured for AGPL compatible distribution. Read `LICENSING.md` before changing or redistributing the processing engine. The production build publishes the full application source archive, required licence texts, exact source links and engine checksums.

Do not describe this build as commercially licensed. A commercial distributor must first obtain the appropriate rights from Artifex and review its separate obligations. Proprietary licence material does not belong in this repository.

## Build

```sh
npm run build
```

The build performs these gates in order:

1. bundles the typed Worker and copies the pinned local engine assets;
2. verifies the engine checksums;
3. creates the corresponding source archive;
4. builds the hosted application;
5. renders every real route into `static-site/` for static deployment.

The static export is complete only when `static-site/.static-export-complete` exists.

## Tests

Run everything:

```sh
npm test
```

Focused commands:

```sh
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
```

Unit tests cover page ranges, page complements, fixed argument building, option validation, deterministic names, filename sanitisation and error mapping. Integration tests run the pinned WebAssembly engine against known fixtures, reopen outputs, check page counts and compare repeated SHA-256 hashes.

Browser checks cover the primary file flow, responsive layout, keyboard controls and outbound network activity. The offline release check must:

1. load the production application online;
2. wait for Service Worker installation;
3. reopen it offline;
4. visit every shipped route;
5. process and download a fixture;
6. confirm there is no unexpected network dependency.

Privacy inspection must instrument `fetch`, XMLHttpRequest, WebSocket, EventSource and `navigator.sendBeacon`. No request may contain document bytes, a filename, extracted text, metadata, a document hash or a password.

## Determinism

PDF rewrite commands omit optional volatile dates and generated IDs. Filenames, page order, image quality, DPI and compression settings are fixed. Each fixture is processed three times and the SHA-256 values must match.

When a standard requires metadata that cannot be made both valid and deterministic, that format stays out of production. This is why PDF/A is not advertised in this release.

## Offline updates

`public/service-worker.js` treats the application and processing engine as one cache version. Installation fetches every route, discovers its built scripts and styles, and caches the Worker, WebAssembly binary, icons, manifest and legal files. A replacement cache must install completely before the old cache is removed.

Increment `CACHE_VERSION` whenever an application or engine asset changes. Do not reuse the old cache name for a different JavaScript/WASM pair.

## GPT Sites deployment

SnackPDF is deployed through its existing GPT Sites project. The verified build contains the Cloudflare Worker-compatible server bundle, static application assets and the project hosting metadata. The release gate rejects unknown route folders, duplicate public identity aliases, copied files, missing Worker/WASM/source materials, sitemap or Service Worker drift, and invalid checksums before a version can be published.

## Updating the engine

1. Review the new upstream licence and release notes.
2. Pin an exact package version and source commit.
3. Rebuild it with the recorded Emscripten environment.
4. Update and verify SHA-256 values.
5. Run every integration, fidelity and determinism fixture.
6. Run browser privacy and offline tests.
7. Increment the Service Worker cache version.
8. Update the legal notices and corresponding source links.

## Adding a tool

**A new document tool cannot be added merely by building a UI for it. Its core document transformation must first be proven using the local Ghostscript WASM engine, with fidelity, offline, privacy and determinism tests.**

Use this sequence:

1. prove the operation with the exact pinned WebAssembly engine;
2. create representative fixtures;
3. confirm acceptable visual and structural fidelity;
4. confirm byte-for-byte deterministic output;
5. confirm complete offline operation;
6. confirm no document-related network communication;
7. add a typed, allowlisted command configuration;
8. add automated tests;
9. add the user interface;
10. add navigation and honest metadata.

If the first step fails, stop. Do not add another PDF engine, a server fallback, a disabled page or a “coming soon” link.
