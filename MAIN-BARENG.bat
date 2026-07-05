@echo off
title Stickman FPP - Main Bareng
cd /d "%~dp0"

echo ============================================
echo   Stickman FPP Online - Main Bareng
echo ============================================
echo.

set "CF=cloudflared"
where cloudflared >nul 2>&1
if errorlevel 1 (
  if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" (
    set "CF=C:\Program Files (x86)\cloudflared\cloudflared.exe"
  ) else if exist "C:\Program Files\cloudflared\cloudflared.exe" (
    set "CF=C:\Program Files\cloudflared\cloudflared.exe"
  ) else (
  echo [ERROR] cloudflared belum terinstall.
  echo.
  echo Install dulu dengan perintah:
  echo   winget install Cloudflare.cloudflared
  echo.
  echo Atau jalankan: INSTALL-TUNNEL.bat
  pause
  exit /b 1
  )
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js belum terinstall.
  echo Download: https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Menginstall dependencies...
  call npm install
  echo.
)

echo [1/2] Menjalankan game server di port 3000...
start "Stickman Server" cmd /k "cd /d "%~dp0" && npm start"

echo Menunggu server siap...
timeout /t 4 /nobreak >nul

echo [2/2] Membuka Cloudflare Tunnel...
echo.
echo ============================================
echo   COPY LINK https://....trycloudflare.com
echo   dari jendela "Cloudflare Tunnel" lalu
echo   bagikan ke teman kamu!
echo ============================================
echo.
start "Cloudflare Tunnel" cmd /k ""%CF%" tunnel --url http://localhost:3000"

echo.
echo Dua jendela baru sudah dibuka:
echo   - Stickman Server  (jangan ditutup)
echo   - Cloudflare Tunnel (copy link dari sini)
echo.
echo Kamu sendiri bisa buka: http://localhost:3000
echo.
pause