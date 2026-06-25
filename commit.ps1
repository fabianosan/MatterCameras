param(
    [Parameter(Position = 0, Mandatory = $false, ValueFromRemainingArguments = $true)]
    [string[]] $MessageParts,

    [switch] $Push,

    [switch] $Help
)

$ErrorActionPreference = 'Stop'

function Show-Usage {
    Write-Host 'Usage: ./commit.ps1 "commit message" [-Push]'
    Write-Host ''
    Write-Host 'Stages all changes with git add -A and creates a commit with the provided message.'
    Write-Host 'Use -Push to also push the current branch after the commit succeeds.'
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if ($Help) {
    Show-Usage
    exit 0
}

if (-not $MessageParts -or $MessageParts.Count -eq 0) {
    Show-Usage
    throw 'Commit message is required.'
}

$commitMessage = ($MessageParts -join ' ').Trim()
if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    Show-Usage
    throw 'Commit message is required.'
}

& git add -A
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& git commit -m $commitMessage
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Push) {
    $currentBranch = (& git branch --show-current).Trim()
    if ([string]::IsNullOrWhiteSpace($currentBranch)) {
        throw 'Unable to determine current branch for push.'
    }
    & git push origin $currentBranch
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

exit 0
