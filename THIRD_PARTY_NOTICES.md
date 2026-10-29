# Third party notices

## Ghostscript / GhostPDL

- Version in the browser build: Ghostscript 10.06.0
- Package: `@okathira/ghostpdl-wasm@1.1.0`
- Package source commit: `a62b7d686b21cf88f6425b3e989d1062b9af4256`
- Package licence: GNU Affero General Public License, version 3 or later
- Upstream: <https://github.com/ArtifexSoftware/ghostpdl>
- WebAssembly build source: <https://github.com/okathira/ghostpdl-wasm/tree/a62b7d686b21cf88f6425b3e989d1062b9af4256>

Bundled artefact SHA-256 values:

```text
5e7e3b3dfc7afc5e60de8dd6dab66145c75afb74f7d671f711f390b3bb69c6d0  gs.js
e8aaf3af75da65fe0af8d49b30fa717e4ff13eedbbdc0cdd5700f54fb8f667e6  gs.wasm
```

The full AGPL licence text is included in `LICENSE`, `engine/licences/AGPL-3.0.txt` and the production legal assets.

## Browser application runtime

- React, React DOM and react-server-dom-webpack 19.2.6 — MIT, copyright Meta Platforms, Inc. and affiliates.
- Next.js 16.3.2 — MIT, copyright 2025 Vercel, Inc.
- Vinext 0.0.50 — MIT, copyright 2026 Cloudflare, Inc.

The corresponding MIT notice text is included in `public/legal/RUNTIME-MIT-NOTICES.txt` and published with the application.

## PDF and OCR browser runtimes

- PDF.js 6.3.289 (`pdfjs-dist`) — Apache License 2.0; renders pages locally for OCR, redaction previews and flat-form annotations. Upstream: <https://github.com/mozilla/pdf.js>
- Tesseract.js 7.0.0 and Tesseract.js Core 7.0.0 — Apache License 2.0; runs OCR locally in a browser Worker. Upstream: <https://github.com/naptha/tesseract.js>
- English Tesseract data 1.0.0 (`@tesseract.js-data/eng`) — Apache License 2.0; the bundled `eng.traineddata.gz` is the only OCR language currently shipped.
- pdf-lib 1.17.1 — MIT; fills existing AcroForm fields and writes static annotations for PDFs without fields. Upstream: <https://github.com/Hopding/pdf-lib>
- `@pdfsmaller/pdf-encrypt` 1.2.0 — MIT; vendored under `app/lib/vendor/pdf-encrypt/` and used for browser-local PDF 2.0 AES-256 encryption. Upstream: <https://github.com/smither777/pdf-encrypt/tree/v1.2.0>. The copyright and permission notice is published at `/legal/PDF-ENCRYPT-MIT.txt`.

These files are self-hosted under `public/ocr/`. The application sets local worker, core and language paths and disables Tesseract's persistent cache; user documents are not sent to any service.
