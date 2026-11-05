#!/usr/bin/env bash
# Assemble ce qui est publié sur GitHub Pages :
#   /           → site vitrine (module site/, fichiers servis tels quels)
#   /gestion/   → application de gestion (module app/, construite par Vite)
# Usage : scripts/build-pages.sh [préfixe]   (préfixe = « / » ou « /nom-du-depot/ »)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREFIX="${1:-/}"
OUT="$ROOT/public-site"
rm -rf "$OUT" && mkdir -p "$OUT"
cp -R "$ROOT/site/." "$OUT/"
( cd "$ROOT/app" && VITE_BASE="${PREFIX}gestion/" npm run build >/dev/null )
cp -R "$ROOT/app/dist" "$OUT/gestion"
echo "Prêt dans $OUT (site à ${PREFIX}, application à ${PREFIX}gestion/)"
