# SnackPDF licensing modes

SnackPDF supports two deliberate distribution modes. This repository is configured for **AGPL compatible distribution**.

## AGPL compatible distribution

The application source is licensed under the GNU Affero General Public License, version 3 or later. The browser processing component is Ghostscript 10.06.0 from the pinned `@okathira/ghostpdl-wasm@1.1.0` package, which is also distributed under AGPL-3.0-or-later.

The production build publishes:

- the SnackPDF corresponding source archive at `/source/snackpdf-source.tar.gz`;
- the application AGPL text at `/legal/AGPL-3.0.txt`;
- the bundled component licence at `/legal/GHOSTSCRIPT-AGPL-3.0.txt`;
- exact engine checksums at `/engine/checksums.json`;
- a legal page linking to the exact WebAssembly build source commit and upstream source.

The pinned WebAssembly build source is commit `a62b7d686b21cf88f6425b3e989d1062b9af4256` of `okathira/ghostpdl-wasm`. That repository records the exact GhostPDL submodule revision and includes its Emscripten build scripts.

The source archive is generated as part of every production build. Deployment must fail if that archive or the required licence files are absent.

## Commercial distribution

Commercial mode may be used only after the distributor has obtained the appropriate commercial licence from Artifex. SnackPDF does not grant, include or imply those rights. Proprietary licence material must never be committed to this repository.

A commercial distributor must review its agreement, replace the AGPL mode statement in the legal page, and confirm which notices and source obligations still apply before deployment. Setting an environment variable does not create commercial licence rights.

