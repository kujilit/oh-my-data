#!/bin/sh
set -e

if [ ! -d node_modules ] || [ ! -f node_modules/.bin/vite ]; then
  echo "Installing frontend dependencies..."
  npm install
fi

exec npm run dev -- --host 0.0.0.0