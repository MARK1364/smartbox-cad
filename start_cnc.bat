@echo off
title SmartPanel CNC Standalone
cd /d "%~dp0"

echo ====================================================
echo SmartPanel CNC Standalone - Wytwarzanie CAM / DXF
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

echo Otwieram aplikacje CNC w przegladarce...
start http://localhost:8085/cnc.html?standalone=1

npm run dev
pause
