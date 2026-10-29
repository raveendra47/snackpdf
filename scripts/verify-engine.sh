#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/.." && pwd)"
engine_dir="${1:-${project_root}/node_modules/@okathira/ghostpdl-wasm/dist}"
checksum_file="${project_root}/engine/checksums/ghostpdl-wasm-1.1.0.sha256"

[[ -f "${engine_dir}/gs.js" && -f "${engine_dir}/gs.wasm" ]] || {
  echo "Engine files are missing from ${engine_dir}" >&2
  exit 1
}

(
  cd "${engine_dir}"
  sha256sum --check "${checksum_file}"
)

