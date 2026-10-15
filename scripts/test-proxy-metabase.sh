#!/usr/bin/env bash
# ============================================================
# test-proxy-metabase.sh — prueba la conexión con el proxy interno
# ipa.donnet.com.ar/api (Metabase SAI_TEST, tabla UsuariosAccesos).
# Debe correrse DESDE la red interna o desde el navegador de un PC
# de la oficina; Vercel (internet) no puede alcanzar 10.0.0.8.
# Uso: ./scripts/test-proxy-metabase.sh [base_url]
# ============================================================
set -uo pipefail
BASE="${1:-https://ipa.donnet.com.ar/api}"

echo "🧪 Probando proxy Metabase en: $BASE"

echo -n "1) /health ... "
H=$(curl -sS -m 15 "$BASE/health" 2>&1) && echo "OK: $H" || { echo "FALLÓ: $H"; exit 1; }

echo -n "2) /usuarios (todos) ... "
U=$(curl -sS -m 20 "$BASE/usuarios" 2>&1) || { echo "FALLÓ: $U"; exit 1; }
COUNT=$(echo "$U" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).count)}catch{console.log('?')}})")
echo "OK: $COUNT usuarios"

echo -n "3) /usuarios?q=mar (búsqueda) ... "
Q=$(curl -sS -m 20 "$BASE/usuarios?q=mar" 2>&1) || { echo "FALLÓ: $Q"; exit 1; }
QC=$(echo "$Q" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).count)}catch{console.log('?')}})")
echo "OK: $QC resultados para 'mar'"

echo -n "4) POST /usuarios/refresh ... "
R=$(curl -sS -m 30 -X POST "$BASE/usuarios/refresh" 2>&1) || { echo "FALLÓ: $R"; exit 1; }
echo "OK: $(echo "$R" | head -c 120)"

echo ""
echo "✅ Proxy operativo. El frontend consumirá estas mismas rutas."
echo "   Campos esperados por usuario: id, nombre, area, perfil, ubicacionid, estado."
