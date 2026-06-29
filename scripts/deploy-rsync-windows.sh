#!/usr/bin/env bash
# Windows file sync for deploy (Git tar + OpenSSH). Avoids MSYS2 rsync crashes on ARM/Cygwin.
set -euo pipefail

MODE="${1:?full|quick}"

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

DEPLOY_VERSION="$(node -e "const fs=require('fs'); const path=require('path'); const pkg=JSON.parse(fs.readFileSync(path.join(process.argv[1], 'package.json'), 'utf8')); console.log(pkg.version);" "${ROOT}")"

tar_stream_sync() {
    local src="$1"
    local remote_dir="$2"
    shift 2
    local -a excludes=("$@")
    local -a tar_args=(-cf - -C "${src}")
    local pattern
    for pattern in "${excludes[@]}"; do
        tar_args+=(--exclude="${pattern}")
    done
    tar_args+=(.)
    tar "${tar_args[@]}" | deploy_ssh "${REMOTE}" "mkdir -p '${remote_dir}' && cd '${remote_dir}' && tar -xf -"
}

recreate_and_tar_sync() {
    local src="$1"
    local remote_dir="$2"
    shift 2
    deploy_ssh "${REMOTE}" "rm -rf '${remote_dir}' && mkdir -p '${remote_dir}'"
    tar_stream_sync "${src}" "${remote_dir}" "$@"
}

scp_file() {
    local local_file="$1"
    local remote_path="$2"
    deploy_scp "${local_file}" "${REMOTE}:${remote_path}"
}

quick_sync_bundled() {
    tar -cf - -C "${ROOT}" \
        --exclude='dist/test' --exclude='.DS_Store' --exclude='._*' \
        dist views public docker-compose.yml package.json \
        | deploy_ssh "${REMOTE}" "cd '${DEST}' && rm -rf dist && tar -xf -"
}

case "${MODE}" in
    full)
        echo "==> Deploy Matter Cameras Bridge v${DEPLOY_VERSION} → ${REMOTE}:${DEST} (Windows tar+ssh)"
        tar_stream_sync "${ROOT}" "${DEST}" \
            node_modules dist .git .DS_Store '._*' \
            data/matter-storage data/cameras.json data/config.json \
            data/go2rtc.yaml data/settings.json '*.expect' .env \
            deploy.env .analysis .cursor/ST-beta .cursor/ST-main
        if [ ! -d "${ROOT}/dist" ]; then
            echo "ERROR: ${ROOT}/dist not found. Run 'npm run build' first." >&2
            exit 1
        fi
        recreate_and_tar_sync "${ROOT}/dist" "${DEST}/dist" test .DS_Store '._*'
        ;;
    quick)
        echo "==> Quick deploy Matter Cameras Bridge v${DEPLOY_VERSION} → ${REMOTE}:${DEST} (Windows tar+ssh)"
        if [ ! -d "${ROOT}/dist" ]; then
            echo "ERROR: ${ROOT}/dist not found. Run 'npm run build' first." >&2
            exit 1
        fi
        if [ "${DEPLOY_SSH_MUX}" = true ]; then
            recreate_and_tar_sync "${ROOT}/dist" "${DEST}/dist" test .DS_Store '._*'
            tar_stream_sync "${ROOT}/views" "${DEST}/views" .DS_Store '._*'
            tar_stream_sync "${ROOT}/public" "${DEST}/public" .DS_Store '._*'
            scp_file "${ROOT}/docker-compose.yml" "${DEST}/docker-compose.yml"
            scp_file "${ROOT}/package.json" "${DEST}/package.json"
        else
            quick_sync_bundled
        fi
        ;;
    *)
        echo "Unknown mode: ${MODE}" >&2
        exit 1
        ;;
esac

echo "==> File sync complete."
