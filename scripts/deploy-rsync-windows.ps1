param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Full', 'Quick')]
    [string]$Mode
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
. (Join-Path $root 'scripts/resolve-deploy-bash.ps1')

$bash = Get-DeployBash
$modeArg = $Mode.ToLower()
& $bash (Join-Path $root 'scripts/deploy-rsync-windows.sh') $modeArg
exit $LASTEXITCODE
