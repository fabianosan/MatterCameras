#!/usr/bin/env bash
#
# Pull a GitHub release (or main) and rebuild Docker services on the host.
# Invoked from the Web UI when MATTER_CAMERAS_SELF_UPDATE_ROOT is set.
#
# Requires: git checkout of MatterCameras, Node.js/npm on PATH, docker compose,
# and /var/run/docker.sock (see docker-compose.update.yml).
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

TARGET="${1:-}"
echo "==> Matter Cameras Bridge self-update (${ROOT})"

if [[ ! -d .git ]]; then
  echo "ERROR: .git not found — clone https://github.com/patricktd/MatterCameras to use self-update." >&2
  exit 1
fi

git fetch --tags origin

if [[ -n "${TARGET}" ]]; then
  TAG="v${TARGET#v}"
  echo "==> Checking out ${TAG}"
  git checkout "${TAG}"
else
  echo "==> Fast-forwarding main"
  git pull --ff-only origin main
fi

echo "==> Installing dependencies and building dist/"
npm ci
npm run build

COMPOSE_ARGS=(-f docker-compose.yml)
if [[ -f docker-compose.update.yml ]]; then
  COMPOSE_ARGS+=(-f docker-compose.update.yml)
fi

echo "==> Rebuilding and restarting containers"
docker compose "${COMPOSE_ARGS[@]}" build app go2rtc
docker compose "${COMPOSE_ARGS[@]}" up -d
docker compose "${COMPOSE_ARGS[@]}" restart app

echo "==> Self-update complete"
