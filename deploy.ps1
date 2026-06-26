$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $root 'scripts/resolve-deploy-bash.ps1')

$bash = Get-DeployBash
$bashArgs = @((Join-Path $root 'scripts/deploy-windows.sh'), 'full') + $args
& $bash @bashArgs
exit $LASTEXITCODE
