@echo off
setlocal
title NIGHTTRACE
cd /d "%~dp0"

if exist "%~dp0NIGHTTRACE Launcher.exe" (
  start "" "%~dp0NIGHTTRACE Launcher.exe"
  exit /b 0
)

echo.
echo   NIGHTTRACE launcher executable was not found.
echo   Rebuild it from launcher\NighttraceLauncher.cs or use the README.
echo.
pause
exit /b 1
