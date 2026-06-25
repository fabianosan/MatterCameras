@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
cd /d "%ROOT%"

if "%~1"=="" goto usage

set "push_after=0"
set "commit_message="

:parse_args
if "%~1"=="" goto run_commit
if /I "%~1"=="--push" (
    set "push_after=1"
    shift
    goto parse_args
)
if /I "%~1"=="--help" goto usage
if /I "%~1"=="-h" goto usage

if defined commit_message (
    set "commit_message=!commit_message! %~1"
) else (
    set "commit_message=%~1"
)
shift
goto parse_args

:run_commit
if not defined commit_message goto usage_error

git add -A
if errorlevel 1 exit /b 1

git commit -m "%commit_message%"
if errorlevel 1 exit /b 1

if "%push_after%"=="1" (
    set "current_branch="
    for /f "usebackq delims=" %%I in (`git branch --show-current`) do set "current_branch=%%I"
    if not defined current_branch (
        echo ERROR: unable to determine current branch for push.
        exit /b 1
    )
    git push origin "!current_branch!"
    if errorlevel 1 exit /b 1
)

exit /b 0

:usage_error
echo ERROR: commit message is required.
echo.

:usage
echo Usage: commit.cmd "commit message" [--push]
echo.
echo Stages all changes with git add -A and creates a commit with the provided message.
echo Use --push to also push the current branch after the commit succeeds.
exit /b 1
