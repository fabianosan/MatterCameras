@echo off
setlocal

set "ROOT=%~dp0"

powershell -ExecutionPolicy Bypass -File "%ROOT%sync.ps1" %*
exit /b %errorlevel%
