#!/bin/bash
set -e

if [ "$EUID" -ne 0 ]; then
  echo "Butuh root — menjalankan ulang dengan sudo..."
  exec sudo -E bash "$0" "$@"
fi

PUBKEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGWcCZDcvjqE01+inxayOJmmm8mhqPjFNcLK0zjy/WOm sahabidrus@gmail.com"

echo "=== Setup SSH Key ==="
mkdir -p ~/.ssh
chmod 700 ~/.ssh
grep -qF "$PUBKEY" ~/.ssh/authorized_keys 2>/dev/null || echo "$PUBKEY" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
echo "SSH key OK"

echo "=== Deploy Stickman FPP Online ==="

mkdir -p /var/lib/apt/lists/partial
chmod 755 /var/lib/apt/lists/partial

export DEBIAN_FRONTEND=noninteractive
apt update -y
apt install -y curl git ufw

if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi

ufw allow 22
ufw allow 3000
ufw allow 80
ufw allow 443
ufw --force enable

mkdir -p /var/www
cd /var/www

if [ -d "stickman-fpp-online" ]; then
  cd stickman-fpp-online
  git pull origin main
else
  git clone https://github.com/IdrusShahab/stickman-fpp-online.git
  cd stickman-fpp-online
fi

npm install

if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi

pm2 delete stickman 2>/dev/null || true
pm2 start server.js --name stickman
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

IP=$(curl -s --max-time 5 ifconfig.me || hostname -I | awk '{print $1}')
echo ""
echo "========================================"
echo "  DEPLOY SELESAI!"
echo "  Game: http://${IP}:3000"
echo "========================================"
pm2 status