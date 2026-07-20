#!/bin/bash
# Run this from inside the patch folder:
# cd ~/Downloads/patch && bash apply.sh

REPO="$HOME/Downloads/oryele_v182-7-8"
PATCH="$(cd "$(dirname "$0")" && pwd)"

cp "$PATCH/Footer.astro"          "$REPO/src/components/Footer.astro"
cp "$PATCH/Hero.astro"            "$REPO/src/components/Hero.astro"
cp "$PATCH/Navbar.astro"          "$REPO/src/components/Navbar.astro"
cp "$PATCH/support-index.astro"   "$REPO/src/pages/support/index.astro"
mkdir -p "$REPO/src/pages/support/search"
cp "$PATCH/search-index.astro"    "$REPO/src/pages/support/search/index.astro"
cp "$PATCH/help-center-index.astro" "$REPO/src/pages/resources/help-center/index.astro"
cp "$PATCH/chat.js"               "$REPO/functions/api/chat.js"
cp "$PATCH/subscribe.js"          "$REPO/functions/api/subscribe.js"
cp "$PATCH/wrangler.jsonc"        "$REPO/wrangler.jsonc"
cp "$PATCH/platform-interactive.png" "$REPO/public/platform-interactive.png"

echo "All files patched into $REPO"
