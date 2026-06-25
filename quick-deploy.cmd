@echo off
setlocal

set "ROOT=%~dp0"

where bash >nul 2>nul
if errorlevel 1 (
    echo ERROR: bash not found in PATH.
    echo Install Git for Windows and run this script from Git Bash or a shell with bash, rsync, and ssh available.
    exit /b 1
)

bash "%ROOT%scripts/quick-deploy.sh" %*
exit /b %errorlevel%
