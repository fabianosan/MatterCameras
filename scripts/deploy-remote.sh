#!/usr/bin/env bash
# Remote Docker steps after files are synced (shared by deploy.sh and deploy.ps1).
set -euo pipefail

MODE="${1:-full}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=deploy-env.sh
source "${ROOT}/scripts/deploy-env.sh"
load_deploy_env "${ROOT}"

# shellcheck source=deploy-ssh-env.sh
source "${ROOT}/scripts/deploy-ssh-env.sh"
setup_deploy_ssh

HOST="${DEPLOY_HOST}"
USER="${DEPLOY_USER}"
DEST="${DEPLOY_DIR}"
REMOTE="${USER}@${HOST}"

case "${MODE}" in
    full)
        echo "==> Building and starting containers..."
        deploy_ssh "${REMOTE}" bash -s <<EOF
set -euo pipefail
cd "${DEST}"
mkdir -p data
[ -f data/cameras.json ] || echo '{"cameras":[]}' > data/cameras.json
docker compose down 2>/dev/null || true
docker compose up --build -d
docker compose restart app
docker compose ps
echo ""
echo "Web UI:  http://${HOST}:3202"
echo "go2rtc:  http://${HOST}:3203"
echo "Matter:  ${HOST}:5550"
EOF
        ;;
    quick)
        deploy_ssh "${REMOTE}" "cd ${DEST} && docker compose up -d app && docker compose restart app && sleep 4 && docker compose ps app"
        ;;
    *)
        echo "Unknown deploy-remote mode: ${MODE}" >&2
        exit 1
        ;;
esac

echo "    Verify: curl -s http://${HOST}:3202/api/version"
