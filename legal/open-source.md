# Open source licences

SnackPDF is distributed in AGPL compatible mode. The complete corresponding source, build scripts and licence materials are published with the application.

The browser processing component is Ghostscript 10.06.0 from `@okathira/ghostpdl-wasm@1.1.0`, licensed under AGPL-3.0-or-later. Its exact source commit is `a62b7d686b21cf88f6425b3e989d1062b9af4256`.

The shipped React, React DOM, react-server-dom-webpack, Next.js and Vinext runtime notices are published at `/legal/RUNTIME-MIT-NOTICES.txt`.

Password protection vendors `@pdfsmaller/pdf-encrypt@1.2.0` under `app/lib/vendor/pdf-encrypt/`. It is used for browser-local PDF 2.0 AES-256 encryption. The vendored module retains its upstream copyright header and MIT notice; the published copy is at `/legal/PDF-ENCRYPT-MIT.txt`.

See `LICENSING.md`, `THIRD_PARTY_NOTICES.md` and the licence files in `engine/licences`.
