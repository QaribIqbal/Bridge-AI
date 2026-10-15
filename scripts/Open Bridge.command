#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
APP="$(pwd)/Bridge.app"
if [[ ! -d "$APP" ]]; then
  echo "Unzip the download first, then double-click Open Bridge.command in that folder."
  exit 1
fi
xattr -cr "$APP"
codesign --force --deep --sign - "$APP"
open "$APP"
