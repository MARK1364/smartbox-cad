@echo off
title Crevo Furniture Platform
cd /d "%~dp0"

echo ====================================================
echo Crevo Furniture Platform - Katalog Modeli CAD
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

echo Otwieram Platforme Mebli w przegladarce...
start http://localhost:8085/platforma.html

npm run dev
pause
