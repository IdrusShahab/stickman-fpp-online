@echo off
title Deploy Update ke VPS
cd /d "%~dp0"

set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
set "VPS=root@157.10.161.95"
set "GAME_DIR=/var/www/stickman-fpp-online"

echo ============================================
echo   Deploy Update - Stickman FPP Online
echo ============================================
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git belum terinstall.
  pause
  exit /b 1
)

echo [1/3] Push ke GitHub...
git add -A
set /p MSG="Pesan commit (kosongkan = update game): "
if "%MSG%"=="" set MSG=Update game
git commit -m "%MSG%" 2>nul
if errorlevel 1 (
  echo Tidak ada perubahan baru, lanjut update VPS...
) else (
  git push origin main
  if errorlevel 1 (
    echo [ERROR] Push ke GitHub gagal.
    pause
    exit /b 1
  )
  echo Push berhasil.
)
echo.

echo [2/3] Update VPS...
if exist "%SSH_KEY%" (
  ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=accept-new %VPS% "cd %GAME_DIR% && git pull origin main && npm install && pm2 restart stickman && echo. && echo UPDATE SELESAI && pm2 status stickman"
) else (
  ssh -o StrictHostKeyChecking=accept-new %VPS% "cd %GAME_DIR% && git pull origin main && npm install && pm2 restart stickman && echo. && echo UPDATE SELESAI && pm2 status stickman"
)
if errorlevel 1 (
  echo [ERROR] Update VPS gagal. Coba login manual: ssh %VPS%
  pause
  exit /b 1
)

echo.
echo [3/3] Selesai!
echo Game online: http://157.10.161.95:3000
echo.
pause