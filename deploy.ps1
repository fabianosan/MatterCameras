$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command bash -ErrorAction SilentlyContinue)) {
    Write-Error 'bash not found in PATH. Install Git for Windows and use a shell with bash, rsync, and ssh available.'
}

& bash "$root/scripts/deploy.sh" @args
exit $LASTEXITCODE
