@echo off
title Studio 3D Standalone
cd /d "%~dp0"

echo ====================================================
echo Studio 3D Standalone - Kreator Akcesoriow i Blokow
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

echo Otwieram Studio 3D w przegladarce...
start http://localhost:8085/studio.html

npm run dev
pause
