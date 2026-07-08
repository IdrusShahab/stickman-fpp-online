#!/bin/bash
set -e

if [ "$EUID" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

cd /var/www/stickman-fpp-online

echo "=== Pull update dari GitHub ==="
git pull origin main

echo "=== Install dependencies ==="
npm install

echo "=== Restart game ==="
pm2 restart stickman

IP=$(curl -s --max-time 5 ifconfig.me || hostname -I | awk '{print $1}')
echo ""
echo "Update selesai! Game: http://${IP}:3000"
pm2 status stickman