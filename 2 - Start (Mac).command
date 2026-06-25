#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "[!] Node.js is not installed."
  echo "    Install it first from https://nodejs.org (click the LTS button),"
  echo "    then run this file again."
  echo
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo
  echo "First run - installing the app's parts. This can take a few minutes..."
  echo
  npm install
fi

echo
echo "==============================================="
echo "   TennisTimez Script Studio is starting..."
echo "==============================================="
echo
echo "A browser tab will open at http://localhost:3000 shortly."
echo "If it opens on a different number (e.g. 3001), use the address shown below."
echo
echo "KEEP THIS WINDOW OPEN while you use the app."
echo "To stop the app: close this window (or press Control+C)."
echo

( sleep 6; open http://localhost:3000 ) &
npm run dev
