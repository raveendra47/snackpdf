#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci and wait for it to finish before building." >&2
  exit 69
fi

echo "Running bounded vinext build..."
node "${SITES_PROJECT_ROOT}/scripts/prepare-ocr-assets.mjs"
node "${SITES_PROJECT_ROOT}/scripts/build-engine-assets.mjs"
node "${SITES_PROJECT_ROOT}/scripts/version-service-worker.mjs"
"${SITES_PROJECT_ROOT}/scripts/verify-engine.sh"
node "${SITES_PROJECT_ROOT}/scripts/build-source-archive.mjs"
node "${SITES_PROJECT_ROOT}/scripts/run-with-timeout.mjs" \
  "${SITES_BUILD_TIMEOUT_MS:-180000}" \
  "${vinext}" build

# GPT Sites serves this Vinext helper as a public file but does not apply it.
# Keep release headers in the application Worker and do not publish the inert file.
rm -f "${SITES_PROJECT_ROOT}/dist/client/_headers"

node "${SITES_PROJECT_ROOT}/scripts/export-static.mjs"
node "${SITES_PROJECT_ROOT}/scripts/assert-release-inventory.mjs"

[[ -f "${SITES_PROJECT_ROOT}/static-site/index.html" ]] || {
  echo "Static export is missing." >&2
  exit 1
}

for required in \
  "static-site/source/snackpdf-source.tar.gz" \
  "static-site/source/snackpdf-source.tar.gz.sha256" \
  "static-site/legal/AGPL-3.0.txt" \
  "static-site/legal/GHOSTSCRIPT-AGPL-3.0.txt" \
  "static-site/legal/PDF-ENCRYPT-MIT.txt" \
  "static-site/legal/RUNTIME-MIT-NOTICES.txt" \
  "static-site/engine/checksums.json" \
  "static-site/.static-export-complete"; do
  [[ -f "${SITES_PROJECT_ROOT}/${required}" ]] || {
    echo "Required release material is missing: ${required}" >&2
    exit 1
  }
done
