@echo off
title Install Cloudflare Tunnel
echo Menginstall cloudflared via winget...
echo.
winget install Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
echo.
if errorlevel 1 (
  echo Gagal install otomatis.
  echo Download manual: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
) else (
  echo Berhasil! Tutup dan buka terminal baru, lalu jalankan MAIN-BARENG.bat
)
echo.
pause