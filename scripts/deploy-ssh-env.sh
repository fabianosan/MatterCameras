# shellcheck shell=bash
# Shared SSH for deploy. Multiplexing (ControlMaster) works with Git for Windows ssh only —
# native Windows OpenSSH does not support ControlPath (getsockname failed: Not a socket).

setup_deploy_ssh() {
    : "${DEPLOY_HOST:?}"
    : "${DEPLOY_USER:?}"

    HOST="${DEPLOY_HOST}"
    USER="${DEPLOY_USER}"
    REMOTE="${USER}@${HOST}"

    DEPLOY_SSH_MUX_DIR="${HOME}/.ssh/matter-deploy"
    mkdir -p "${DEPLOY_SSH_MUX_DIR}"
    DEPLOY_SSH_CONTROL="${DEPLOY_SSH_MUX_DIR}/%C"

    DEPLOY_SSH_MUX=false
    DEPLOY_SSH_OPTS=()

    if [ -x "/c/Program Files/Git/usr/bin/ssh.exe" ]; then
        SSH="/c/Program Files/Git/usr/bin/ssh.exe"
        SCP="/c/Program Files/Git/usr/bin/scp.exe"
        DEPLOY_SSH_MUX=true
    elif [ -x "/c/Program Files (x86)/Git/usr/bin/ssh.exe" ]; then
        SSH="/c/Program Files (x86)/Git/usr/bin/ssh.exe"
        SCP="/c/Program Files (x86)/Git/usr/bin/scp.exe"
        DEPLOY_SSH_MUX=true
    elif [ -x /c/Windows/System32/OpenSSH/ssh.exe ]; then
        SSH=/c/Windows/System32/OpenSSH/ssh.exe
        SCP=/c/Windows/System32/OpenSSH/scp.exe
    elif [ -x /c/Windows/System32/ssh.exe ]; then
        SSH=/c/Windows/System32/ssh.exe
        SCP=/c/Windows/System32/scp.exe
    else
        SSH=ssh
        SCP=scp
        if command -v uname >/dev/null 2>&1 && ! uname -s 2>/dev/null | grep -qiE 'mingw|msys|cygwin'; then
            DEPLOY_SSH_MUX=true
        fi
    fi

    if [ "${DEPLOY_SSH_MUX}" = true ]; then
        DEPLOY_SSH_OPTS=(
            -o ControlMaster=auto
            -o "ControlPath=${DEPLOY_SSH_CONTROL}"
            -o ControlPersist=600
        )
        DEPLOY_RSYNC_RSH="ssh -o ControlMaster=auto -o ControlPath=${DEPLOY_SSH_CONTROL} -o ControlPersist=600"
    else
        DEPLOY_RSYNC_RSH=ssh
    fi

    # Git Bash on Windows: ControlMaster leaves stale sockets and spams mux_client_request_session.
    # With ssh-copy-id / keys, separate connections are fine.
    if command -v uname >/dev/null 2>&1 && uname -s 2>/dev/null | grep -qiE 'mingw|msys|cygwin'; then
        DEPLOY_SSH_MUX=false
        DEPLOY_SSH_OPTS=()
        DEPLOY_RSYNC_RSH=ssh
    fi
}

deploy_ssh() {
    "${SSH}" "${DEPLOY_SSH_OPTS[@]}" "$@"
}

deploy_scp() {
    "${SCP}" "${DEPLOY_SSH_OPTS[@]}" "$@"
}

deploy_ssh_mux_start() {
    if [ "${DEPLOY_SSH_MUX}" != true ]; then
        return 0
    fi
    rm -f "${DEPLOY_SSH_MUX_DIR}"/* 2>/dev/null || true
    deploy_ssh -O exit "${REMOTE}" >/dev/null 2>&1 || true
    if deploy_ssh -O check "${REMOTE}" >/dev/null 2>&1; then
        return 0
    fi
    deploy_ssh -MNf "${REMOTE}"
}

deploy_ssh_mux_stop() {
    if [ "${DEPLOY_SSH_MUX}" != true ]; then
        return 0
    fi
    deploy_ssh -O exit "${REMOTE}" >/dev/null 2>&1 || true
}
