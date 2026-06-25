@echo off
cd /d "%~dp0"
title TennisTimez Script Studio

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [!] Node.js is not installed.
  echo     Install it first from https://nodejs.org  ^(click the "LTS" button^),
  echo     then run this file again.
  echo.
  pause
  exit /b
)

if not exist "node_modules\" (
  echo.
  echo First run - installing the app's parts. This can take a few minutes...
  echo.
  call npm install
)

echo.
echo ===============================================
echo    TennisTimez Script Studio is starting...
echo ===============================================
echo.
echo A browser tab will open at http://localhost:3000 in a few seconds.
echo If it opens on a different number ^(e.g. 3001^), use the address shown below.
echo.
echo KEEP THIS WINDOW OPEN while you use the app.
echo To stop the app: close this window ^(or press Ctrl+C^).
echo.

start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 6; Start-Process 'http://localhost:3000'"
call npm run dev

echo.
echo The app has stopped. You can close this window.
pause
