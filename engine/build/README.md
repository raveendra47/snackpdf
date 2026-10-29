# Engine build record

SnackPDF pins `@okathira/ghostpdl-wasm@1.1.0`, published from source commit `a62b7d686b21cf88f6425b3e989d1062b9af4256` with npm provenance.

That source uses the `emscripten/emsdk:4.0.13` build image and records the exact GhostPDL revision as a Git submodule. Run `scripts/build-engine.sh` to reproduce the upstream build and `scripts/verify-engine.sh` to compare the result with the checked checksums.

The configured build keeps the in-memory filesystem and the `callMain` entry point. Its file output drivers are limited to BMP, JPEG, PNG, PostScript/PDF and TIFF families. SnackPDF exposes only the smaller set proven by its capability tests.

