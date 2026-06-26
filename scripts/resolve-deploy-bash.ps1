function Initialize-DeployPath {
    $scoopShims = Join-Path $env:USERPROFILE 'scoop\shims'
    if ((Test-Path $scoopShims) -and ($env:Path -notlike "*$scoopShims*")) {
        $env:Path = "$scoopShims;$env:Path"
    }
}

function Get-DeployBash {
    $gitBashPaths = @(
        (Join-Path ${env:ProgramFiles} 'Git\bin\bash.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Git\bin\bash.exe')
    )
    foreach ($path in $gitBashPaths) {
        if (Test-Path $path) { return $path }
    }

    $bashCmd = Get-Command bash -ErrorAction SilentlyContinue
    if ($bashCmd) {
        $source = $bashCmd.Source
        $isWslLauncher = $source -match '\\Windows\\System32\\bash\.exe$' -or $source -match '\\WindowsApps\\bash\.exe$'
        if (-not $isWslLauncher) { return $source }
    }

    throw @'
Git Bash not found. PowerShell resolved "bash" to the WSL launcher, which is not used for deploy.

Install Git for Windows: https://git-scm.com/download/win
Then run .\deploy.ps1 again (the wrapper prefers Git Bash over WSL).
'@
}

function Assert-DeployRsync {
    param([string]$BashPath)

    $gitRoot = Split-Path (Split-Path $BashPath -Parent) -Parent
    $rsyncInGit = Join-Path $gitRoot 'usr\bin\rsync.exe'
    if (Test-Path $rsyncInGit) { return }

    $scoopRsync = Join-Path $env:USERPROFILE 'scoop\shims\rsync.exe'
    if (Test-Path $scoopRsync) { return }

    $rsyncCmd = Get-Command rsync -ErrorAction SilentlyContinue
    if ($rsyncCmd -and (Test-Path $rsyncCmd.Source)) { return }

    throw @'
rsync not found. Deploy requires rsync on your workstation.

Install one of:
  - Scoop:  scoop bucket add raisercostin https://github.com/raisercostin/raiser-scoop-bucket && scoop install rsync-msys2
  - Chocolatey:  choco install rsync
  - cwRsync: https://itefix.net/cwrsync  (add its bin folder to PATH)

Git for Windows does not include rsync by default.
'@
}
