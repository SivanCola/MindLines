#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="Mindline"
RELEASE_DIR="$ROOT_DIR/release"
BUILDER="$ROOT_DIR/node_modules/.bin/electron-builder"

if [[ ! -x "$BUILDER" ]]; then
  echo "electron-builder not found. Run npm install first." >&2
  exit 1
fi

echo "==> Cleaning previous mac release artifacts"
rm -rf "$ROOT_DIR/dist" \
  "$RELEASE_DIR/mac" \
  "$RELEASE_DIR/mac-arm64" \
  "$RELEASE_DIR/mac-universal" \
  "$RELEASE_DIR"/*.dmg \
  "$RELEASE_DIR"/*.zip \
  "$RELEASE_DIR"/*.blockmap

echo "==> Building renderer and main process"
npm run build

if [[ -z "${CSC_IDENTITY_AUTO_DISCOVERY:-}" && -z "${CSC_NAME:-}" && -z "${CSC_LINK:-}" ]]; then
  export CSC_IDENTITY_AUTO_DISCOVERY=false
  echo "==> Code signing disabled for local/internal distribution"
else
  echo "==> Code signing environment detected; electron-builder will use it"
fi

echo "==> Packaging ${APP_NAME} for Apple Silicon (arm64)"
"$BUILDER" --mac dmg zip --arm64 --publish never

echo "==> Packaging ${APP_NAME} for Intel Mac (x64)"
"$BUILDER" --mac dmg zip --x64 --publish never

echo "==> Artifacts"
find "$RELEASE_DIR" -maxdepth 1 -type f \( -name '*.dmg' -o -name '*.zip' \) -print | sort
