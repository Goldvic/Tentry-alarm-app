#!/usr/bin/env bash
# Tentry Alarm — automated dependency fix + EAS preview build
#
# Non-interactive: git init/commit if needed, then EAS preview build
# (no y/N prompts).
#
# Usage: ./fix-and-build.sh

set -euo pipefail

echo "==> [1/7] Installing dependencies..."
npm install

echo ""
echo "==> [2/7] Verifying expo-splash-screen / expo-font match SDK 51..."
npx expo install expo-splash-screen expo-font

echo ""
echo "==> [3/7] Aligning all Expo packages with the installed SDK..."
npx expo install --fix

echo ""
echo "==> [4/7] Re-pinning tailwindcss to 3.3.2 (nativewind v2 requirement)..."
npm uninstall tailwindcss
npm install --save-exact --save-dev tailwindcss@3.3.2

echo ""
echo "==> [5/7] Running expo-doctor (informational — won't stop the script)..."
npx expo-doctor || true

echo ""
echo "==> [6/7] Git init + commit lockfile (non-interactive)..."
if [ ! -d .git ]; then
  git init
  if ! git config user.email >/dev/null 2>&1; then
    git config user.email "tentry@local"
    git config user.name "Tentry Build"
  fi
  echo "    Initialized new git repo."
fi

git add -A
if git diff --cached --quiet 2>/dev/null; then
  echo "    (nothing new to commit)"
else
  git commit -m "chore: pin deps for EAS preview build" || echo "    (commit skipped)"
fi

echo ""
echo "==> [7/7] Starting EAS Android preview build (no prompt)..."
if command -v eas >/dev/null 2>&1; then
  eas build --clear-cache -p android --profile preview --non-interactive
else
  echo "⚠️  eas-cli isn't installed. Install it first with:"
  echo "    npm install -g eas-cli"
  echo "Then run:"
  echo "    eas build --clear-cache -p android --profile preview --non-interactive"
  exit 1
fi

echo ""
echo "✅ Done."
