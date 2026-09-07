#!/usr/bin/env bash
# Deploy reutilizable del Reto 30 Apps.
# Uso:  ./deploy.sh            (detecta appXX del nombre de la carpeta: app-07-loquesea)
#       ./deploy.sh app07      (explicito)
set -euo pipefail

HOST="root@31.97.147.227"
KEY="$HOME/.ssh/reto30_ed25519"
BASE="/var/www/reto30"
DOMINIO="reto.icebergmarketingdigital.com"

# --- Guardia dura: CLAUDE.md 9. Los builds JAMAS en el VPS ---
if [ -f /etc/easypanel/data/data.mdb ] || [ "$(hostname)" = "srv893960" ]; then
  echo "ERROR: este script no se ejecuta en el VPS. Los builds van en local." >&2
  exit 1
fi

# --- Resolver que app se despliega ---
APP="${1:-}"
if [ -z "$APP" ]; then
  DIR="$(basename "$PWD")"
  APP="$(printf '%s' "$DIR" | sed -nE 's/^app-?0*([0-9]{1,2}).*/app\1/p')"
  [ -n "$APP" ] && APP="app$(printf '%02d' "${APP#app}")"
fi
if ! printf '%s' "$APP" | grep -qE '^app[0-9]{2}$'; then
  echo "ERROR: no pude determinar la app. Pasa el nombre: ./deploy.sh app07" >&2
  exit 1
fi

DEST="$BASE/$APP"
URL="https://$APP.$DOMINIO"

echo "=========================================="
echo "  Desplegando $APP  ->  $URL"
echo "=========================================="

# --- 1. Build local ---
if [ -f package.json ]; then
  echo "> Build local..."
  npm run build
fi
[ -d dist ] || { echo "ERROR: no existe dist/. Nada que subir." >&2; exit 1; }
echo "  dist/: $(find dist -type f | wc -l) archivos, $(du -sh dist | cut -f1)"

# --- 2. Subida con intercambio atomico ---
echo "> Subiendo..."
tar -czf - -C dist . | ssh -i "$KEY" -o BatchMode=yes "$HOST" "
  set -e
  rm -rf '$DEST.new'
  mkdir -p '$DEST.new'
  tar -xzf - --no-same-owner -C '$DEST.new'
  chown -R root:root '$DEST.new'
  rm -rf '$DEST.old'
  if [ -d '$DEST' ]; then mv '$DEST' '$DEST.old'; fi
  mv '$DEST.new' '$DEST'
  rm -rf '$DEST.old'
"

# --- 3. Smoke test ---
echo "> Comprobando $URL ..."
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL" || echo 000)"
if [ "$CODE" = "200" ]; then
  echo "OK  $URL responde $CODE"
else
  echo "FALLO  $URL respondio $CODE" >&2
  exit 1
fi
