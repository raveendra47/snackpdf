#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/.." && pwd)"
source_root="${project_root}/engine/source/ghostpdl-wasm"
source_commit="a62b7d686b21cf88f6425b3e989d1062b9af4256"

command -v git >/dev/null || { echo "git is required" >&2; exit 69; }
command -v docker >/dev/null || { echo "Docker is required" >&2; exit 69; }

if [[ ! -d "${source_root}/.git" ]]; then
  mkdir -p "$(dirname "${source_root}")"
  git clone https://github.com/okathira/ghostpdl-wasm.git "${source_root}"
fi

git -C "${source_root}" fetch --tags origin
git -C "${source_root}" checkout --detach "${source_commit}"
git -C "${source_root}" submodule update --init --recursive

docker run --rm \
  -v "${source_root}:/src" \
  -w /src \
  emscripten/emsdk:4.0.13 \
  bash -lc './compile.sh'

"${script_dir}/verify-engine.sh" "${source_root}/dist"

