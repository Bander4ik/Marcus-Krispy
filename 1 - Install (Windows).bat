@echo off
cd /d "%~dp0"
title TennisTimez - Install

echo ===============================================
echo    TennisTimez Script Studio - Install
echo ===============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js is not installed.
  echo     Install it first from https://nodejs.org  ^(click the "LTS" button^),
  echo     then run this file again.
  echo.
  pause
  exit /b
)

echo Installing the app's parts. This can take a few minutes the first time...
echo.
call npm install
echo.
echo Done. You can now run "2 - Start (Windows).bat".
echo.
pause
