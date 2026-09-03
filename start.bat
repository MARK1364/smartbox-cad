@echo off
title SmartBox Web Server
cd /d "%~dp0"

echo ====================================================
echo SmartPanel Web - Serwer Deweloperski (Vite + React + TS)
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

echo Otwieram przegladarke...
start http://localhost:8080

npm run dev
pause
