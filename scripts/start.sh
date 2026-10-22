#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "Не найден Node.js 26+. Установи Node и повтори."
  exit 1
fi

if [ ! -d node_modules ]; then
  npm install
fi

if [ ! -d dist ]; then
  npm run build
fi

npm start
