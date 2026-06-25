#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

show_usage() {
    cat <<'EOF'
Usage: ./sync.sh [--no-pull]

Safe Git sync helper for starting work on another machine.
- fetches origin with prune
- shows branch + status
- fast-forwards only when the worktree is clean and the branch is only behind upstream

Options:
  --no-pull   only fetch and report status; never pull
  -h, --help  show this help
EOF
}

no_pull=false
for arg in "$@"; do
    case "$arg" in
        --no-pull) no_pull=true ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo "ERROR: unknown argument: $arg" >&2
            show_usage >&2
            exit 1
            ;;
    esac
done

branch="$(git branch --show-current)"
if [[ -z "$branch" ]]; then
    echo "ERROR: unable to determine current branch (detached HEAD?)." >&2
    exit 1
fi

echo "==> Repository: $ROOT"
echo "==> Branch: $branch"

echo "==> Fetching origin..."
git fetch --prune origin

upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
if [[ -z "$upstream" ]]; then
    echo "==> No upstream configured for $branch."
    git status --short
    exit 0
fi

dirty_output="$(git status --porcelain)"
read -r ahead behind <<<"$(git rev-list --left-right --count HEAD...@{u})"

echo "==> Upstream: $upstream"
echo "==> Ahead: $ahead  Behind: $behind"

if [[ -n "$dirty_output" ]]; then
    echo "==> Working tree has local changes; skipping pull to avoid conflicts."
    git status --short
    exit 0
fi

if [[ "$no_pull" == true ]]; then
    echo "==> Pull skipped (--no-pull)."
    git status --short
    exit 0
fi

if [[ "$ahead" -gt 0 && "$behind" -gt 0 ]]; then
    echo "==> Branch diverged from upstream; skipping automatic pull."
    echo "    Review with: git status -sb && git log --oneline --decorate --graph --max-count=15 --all"
    exit 0
fi

if [[ "$behind" -eq 0 ]]; then
    echo "==> Already up to date."
    git status --short
    exit 0
fi

if [[ "$ahead" -gt 0 ]]; then
    echo "==> Local branch is ahead of upstream; skipping pull."
    git status --short
    exit 0
fi

echo "==> Fast-forwarding from $upstream..."
git pull --ff-only
git status --short
echo "==> Sync complete."
