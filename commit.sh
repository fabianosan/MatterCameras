#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

usage() {
    cat <<'EOF'
Usage: ./commit.sh "commit message" [--push]

Stages all changes with `git add -A` and creates a commit with the provided message.
Use `--push` to also push the current branch after the commit succeeds.
EOF
}

if [[ $# -lt 1 ]]; then
    usage >&2
    exit 1
fi

push_after=false
message_parts=()

for arg in "$@"; do
    case "$arg" in
        --push)
            push_after=true
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            message_parts+=("$arg")
            ;;
    esac
done

if [[ ${#message_parts[@]} -eq 0 ]]; then
    echo "ERROR: commit message is required." >&2
    usage >&2
    exit 1
fi

commit_message="${message_parts[*]}"

git add -A
git commit -m "$commit_message"

if [[ "$push_after" == true ]]; then
    current_branch="$(git branch --show-current)"
    if [[ -z "$current_branch" ]]; then
        echo "ERROR: unable to determine current branch for push." >&2
        exit 1
    fi
    git push origin "$current_branch"
fi
