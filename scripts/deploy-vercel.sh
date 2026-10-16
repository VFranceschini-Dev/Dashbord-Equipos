#!/usr/bin/env bash
# ============================================================
# deploy-vercel.sh — publica Dashbord-Equipos en Vercel
# https://dashbord-equipos.vercel.app/
#
# La app NO necesita backend propio: los usuarios de SAI_TEST se
# leen vía el proxy interno https://ipa.donnet.com.ar/api (Metabase,
# solo lectura) y el ABM va directo a Supabase.
#
# Uso:
#   VERCEL_TOKEN=xxx ./scripts/deploy-vercel.sh            # producción
#   VERCEL_TOKEN=xxx ./scripts/deploy-vercel.sh --preview  # preview
#
# Requiere: npm i -g vercel  (o npx)
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:---prod}"

# --- Validación de variables obligatorias ---
missing=()
[ -f .env ] || missing+=(".env local no existe (copiá .env.example)")
grep -q '^VITE_SUPABASE_URL=.\+' .env 2>/dev/null || missing+=("VITE_SUPABASE_URL")
grep -q '^VITE_SUPABASE_ANON_KEY=.\+' .env 2>/dev/null || missing+=("VITE_SUPABASE_ANON_KEY")
if [ ${#missing[@]} -gt 0 ]; then
  echo "❌ Faltan configuraciones: ${missing[*]}" >&2
  exit 1
fi

# --- Build local (tsc + vite) ---
echo "🔨 npm run build ..."
npm run build

# --- Deploy ---
VERCEL_BIN="vercel"
command -v vercel >/dev/null 2>&1 || VERCEL_BIN="npx --yes vercel"

if [ "$MODE" = "--preview" ]; then
  echo "🚀 Deploy PREVIEW..."
  $VERCEL_BIN deploy --token "$VERCEL_TOKEN"
else
  echo "🚀 Deploy PRODUCCIÓN → https://dashbord-equipos.vercel.app ..."
  $VERCEL_BIN deploy --prod --token "$VERCEL_TOKEN"
fi

echo ""
echo "✅ Listo. Recordá que en Vercel deben estar configuradas (Project > Settings > Environment Variables):"
echo "   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (frontend) e IPA_API_URL, IPA_API_KEY, IPA_DB_ID, IPA_USUARIOS_TABLE_ID, SUPABASE_URL, SUPABASE_ANON_KEY (función api/usuarios)."
echo "   Y en Supabase > Authentication > URL Configuration: Site URL = https://dashbord-equipos.vercel.app"
