$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$envFile = Join-Path $root 'deploy.env'

if (-not (Test-Path $envFile)) {
    Write-Error "Missing deploy.env — copy deploy.env.example first."
}

$hostLine = (Select-String -Path $envFile -Pattern '^\s*DEPLOY_HOST\s*=' | Select-Object -First 1).Line
$userLine = (Select-String -Path $envFile -Pattern '^\s*DEPLOY_USER\s*=' | Select-Object -First 1).Line
$deployHost = ($hostLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
$deployUser = ($userLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
$remote = "${deployUser}@${deployHost}"

$sshDir = Join-Path $env:USERPROFILE '.ssh'
$key = Join-Path $sshDir 'id_ed25519'
$pub = "${key}.pub"

New-Item -ItemType Directory -Force -Path $sshDir | Out-Null

if (-not (Test-Path $key)) {
    Write-Host "==> Generating SSH key at $key"
    ssh-keygen -t ed25519 -f $key -N '""' -C "patri@matter-cameras-deploy"
}

$configPath = Join-Path $sshDir 'config'
$hostBlock = @"

Host matter-deploy $deployHost
    HostName $deployHost
    User $deployUser
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
"@

if (-not (Test-Path $configPath) -or -not (Select-String -Path $configPath -Pattern 'Host matter-deploy' -Quiet)) {
    Add-Content -Path $configPath -Value $hostBlock
    Write-Host "==> Added matter-deploy entry to $configPath"
}

$gitBash = 'C:\Program Files\Git\bin\bash.exe'
if (-not (Test-Path $gitBash)) {
    Write-Error 'Git Bash not found. Install Git for Windows.'
}

Write-Host "==> Installing public key on $remote"
Write-Host "    Enter the server password when prompted (last time)."
Write-Host ""

$copyCmd = "ssh-copy-id -i ~/.ssh/id_ed25519.pub $remote && ssh -o BatchMode=yes $remote 'echo SSH key OK'"
Start-Process -FilePath $gitBash -ArgumentList '-lc', $copyCmd -Wait -NoNewWindow

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "If ssh-copy-id failed, run manually in Git Bash:"
    Write-Host "  ssh-copy-id -i ~/.ssh/id_ed25519.pub $remote"
    exit 1
}

Write-Host ""
Write-Host "==> Done. Test: ssh matter-deploy `"echo ok`""
