#!/bin/bash
set -euo pipefail

DOMAIN="idrusrandom.web.id"
APP_PORT=3000
BASE_PATH="/fppstickman"
PROJECT_DIR="/var/www/stickman-fpp-online"

if [ "$(id -u)" -ne 0 ]; then
  echo "Jalankan dengan sudo: sudo bash setup-subpath.sh"
  exit 1
fi

echo "==> Update Nginx untuk ${DOMAIN}${BASE_PATH}"

cp "${PROJECT_DIR}/nginx-idrusrandom.web.id.conf" "/etc/nginx/sites-available/${DOMAIN}"

if [ -f "/etc/letsencrypt/options-ssl-nginx.conf" ]; then
  cat > "/etc/nginx/sites-available/${DOMAIN}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 10m;

    location = ${BASE_PATH} {
        return 301 ${BASE_PATH}/;
    }

    location ${BASE_PATH}/ {
        proxy_pass http://127.0.0.1:${APP_PORT}${BASE_PATH}/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
EOF
fi

ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
nginx -t
systemctl reload nginx

echo "==> Restart PM2 dengan BASE_PATH=${BASE_PATH}"
cd "${PROJECT_DIR}"
pm2 delete stickman 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "Game: https://${DOMAIN}${BASE_PATH}/"
echo "Selesai."