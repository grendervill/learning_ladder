#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "Не найден Node.js. Нужен Node 26+."
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 26 ]; then
  echo "Нужен Node 26+. Сейчас: $(node -v)"
  exit 1
fi

if ! command -v lua >/dev/null 2>&1; then
  echo "Внимание: lua не найден. Запуск заданий не будет работать."
fi

if ! command -v lua-language-server >/dev/null 2>&1; then
  echo "Внимание: lua-language-server не найден. Редактор будет без LSP."
fi

if [ ! -d node_modules ]; then
  echo "Устанавливаю зависимости…"
  npm install
fi

echo "Собираю интерфейс…"
npm run build

echo "Запускаю LearningLua на http://127.0.0.1:4173"
(sleep 1 && open http://127.0.0.1:4173 >/dev/null 2>&1 || true) &
NODE_ENV=production npm start
