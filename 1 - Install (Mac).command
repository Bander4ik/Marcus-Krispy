#!/bin/bash
cd "$(dirname "$0")"

echo "==============================================="
echo "   TennisTimez Script Studio - Install"
echo "==============================================="
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js is not installed."
  echo "    Install it first from https://nodejs.org (click the LTS button),"
  echo "    then run this file again."
  echo
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

echo "Installing the app's parts. This can take a few minutes the first time..."
echo
npm install
echo
echo "Done. You can now run '2 - Start (Mac).command'."
read -n 1 -s -r -p "Press any key to close..."
