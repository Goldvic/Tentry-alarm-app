#!/usr/bin/env bash
# Tentry Alarm — automated dependency fix + build script
#
# Fixes applied by this script (see chat history for the full diagnosis):
#   1. expo-font / other Expo modules pinned to versions matching SDK 51
#      (fixes: "Plugin [id: 'expo-module-gradle-plugin'] was not found")
#   2. tailwindcss pinned to exactly 3.3.2, required by nativewind v2
#      (fixes: "Use process(css).then(cb) to work with async plugins")
#   3. Generates/commits a lockfile so these versions can't silently drift
#      on the next EAS build.
#
# Usage: ./fix-and-build.sh

set -euo pipefail

echo "==> [1/6] Installing dependencies..."
npm install

echo ""
echo "==> [2/6] Verifying expo-splash-screen / expo-font match SDK 51..."
npx expo install expo-splash-screen expo-font

echo ""
echo "==> [3/6] Aligning all Expo packages with the installed SDK..."
npx expo install --fix

echo ""
echo "==> [4/6] Re-pinning tailwindcss to 3.3.2 (nativewind v2 requirement)..."
npm uninstall tailwindcss
npm install --save-exact --save-dev tailwindcss@3.3.2

echo ""
echo "==> [5/6] Running expo-doctor (informational — won't stop the script)..."
npx expo-doctor || true

echo ""
echo "==> [6/6] Committing lockfile so this can't drift again..."
if [ -d .git ]; then
  git add package.json package-lock.json
  git commit -m "chore: pin expo-font & tailwindcss for EAS build fix" || echo "    (nothing new to commit)"
else
  echo "    Not a git repo — skipping commit. Initialize git and commit"
  echo "    package.json + package-lock.json so this fix sticks."
fi

echo ""
echo "✅ Dependencies fixed and locked."
echo ""

read -p "Kick off the EAS Android build now? [y/N] " -n 1 -r REPLY
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  if command -v eas >/dev/null 2>&1; then
    eas build --clear-cache -p android --profile production
  else
    echo "⚠️  eas-cli isn't installed. Install it first with:"
    echo "    npm install -g eas-cli"
    echo "Then run:"
    echo "    eas build --clear-cache -p android --profile production"
  fi
else
  echo "Skipped. Run this when you're ready:"
  echo "    eas build --clear-cache -p android --profile production"
fi
