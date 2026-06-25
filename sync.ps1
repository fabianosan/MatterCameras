param(
    [switch] $NoPull,
    [switch] $Help
)

$ErrorActionPreference = 'Stop'

function Show-Usage {
    Write-Host 'Usage: ./sync.ps1 [-NoPull]'
    Write-Host ''
    Write-Host 'Safe Git sync helper for starting work on another machine.'
    Write-Host '- fetches origin with prune'
    Write-Host '- shows branch + status'
    Write-Host '- fast-forwards only when the worktree is clean and the branch is only behind upstream'
}

if ($Help) {
    Show-Usage
    exit 0
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$branch = (& git branch --show-current).Trim()
if ([string]::IsNullOrWhiteSpace($branch)) {
    throw 'Unable to determine current branch (detached HEAD?).'
}

Write-Host "==> Repository: $root"
Write-Host "==> Branch: $branch"

Write-Host '==> Fetching origin...'
& git fetch --prune origin
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$upstream = (& git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null).Trim()
if ([string]::IsNullOrWhiteSpace($upstream)) {
    Write-Host "==> No upstream configured for $branch."
    & git status --short
    exit 0
}

$dirtyLines = @(& git status --porcelain)
$counts = (& git rev-list --left-right --count 'HEAD...@{u}').Trim() -split '\s+'
$ahead = [int]$counts[0]
$behind = [int]$counts[1]

Write-Host "==> Upstream: $upstream"
Write-Host "==> Ahead: $ahead  Behind: $behind"

if ($dirtyLines.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace(($dirtyLines -join ''))) {
    Write-Host '==> Working tree has local changes; skipping pull to avoid conflicts.'
    & git status --short
    exit 0
}

if ($NoPull) {
    Write-Host '==> Pull skipped (-NoPull).'
    & git status --short
    exit 0
}

if ($ahead -gt 0 -and $behind -gt 0) {
    Write-Host '==> Branch diverged from upstream; skipping automatic pull.'
    Write-Host '    Review with: git status -sb && git log --oneline --decorate --graph --max-count=15 --all'
    exit 0
}

if ($behind -eq 0) {
    Write-Host '==> Already up to date.'
    & git status --short
    exit 0
}

if ($ahead -gt 0) {
    Write-Host '==> Local branch is ahead of upstream; skipping pull.'
    & git status --short
    exit 0
}

Write-Host "==> Fast-forwarding from $upstream..."
& git pull --ff-only
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& git status --short
Write-Host '==> Sync complete.'
exit 0
