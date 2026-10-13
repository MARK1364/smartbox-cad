@echo off
title SmartParts Studio Standalone
cd /d "%~dp0"

echo ====================================================
echo SmartParts Studio Standalone - Kreator Akcesoriow 3D
echo ====================================================
echo.
echo Wymagany Node.js!
echo Uruchamianie Vite...
echo.

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [BLAD] Nie znaleziono polecenia 'npm'. Zainstaluj Node.js.
    pause
    exit /b
)

echo Otwieram SmartParts Studio w przegladarce...
start http://localhost:8085/smartparts.html

npm run dev
pause
