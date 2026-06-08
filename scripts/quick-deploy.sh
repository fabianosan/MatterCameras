#!/usr/bin/env bash
#
# Fast iteration deploy: sync compiled JS only, restart app container.
# Use this when only TypeScript sources changed and no rebuild is needed.
#
# NEVER touches:
#   - data/cameras.json     (operator-managed camera roster)
#   - data/matter-storage/  (Matter fabric/credentials, irreversible if lost)
#   - data/go2rtc.yaml      (operator-tuned, change via scripts/deploy.sh)
#   - .env                  (secrets)
#
# For a full deploy (image rebuild, yaml updates, etc.) use scripts/deploy.sh.

set -euo pipefail

HOST="${DEPLOY_HOST:-192.168.1.50}"
USER_NAME="${DEPLOY_USER:-patricktd}"
DEST="${DEPLOY_DIR:-/opt/matter-cameras}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Quick deploy MatterCameras → ${USER_NAME}@${HOST}:${DEST}"

if [ ! -d "${ROOT}/dist" ]; then
    echo "ERROR: ${ROOT}/dist not found. Run 'npm run build' first." >&2
    exit 1
fi

rsync -rlvz --delete --omit-dir-times --no-perms --no-owner --no-group \
  --exclude test \
  --exclude '.DS_Store' \
  --exclude '._*' \
  "${ROOT}/dist/" "${USER_NAME}@${HOST}:${DEST}/dist/"

rsync -rlvz --omit-dir-times --no-perms --no-owner --no-group \
  --exclude '.DS_Store' \
  --exclude '._*' \
  "${ROOT}/views/" "${USER_NAME}@${HOST}:${DEST}/views/"

rsync -rlvz --omit-dir-times --no-perms --no-owner --no-group \
  "${ROOT}/docker-compose.yml" "${USER_NAME}@${HOST}:${DEST}/docker-compose.yml"

ssh "${USER_NAME}@${HOST}" "cd ${DEST} && docker compose up -d app && sleep 3 && docker compose ps app"

echo "==> Quick deploy complete."
