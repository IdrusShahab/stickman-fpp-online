#!/bin/bash
set -euo pipefail

DOMAIN="idrusrandon.web.id"
APP_PORT=3000
EMAIL="${SSL_EMAIL:-}"

echo "==> Setup domain: $DOMAIN"

if [ "$(id -u)" -ne 0 ]; then
  echo "Jalankan dengan sudo: sudo bash setup-domain.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y nginx certbot python3-certbot-nginx

cat > "/etc/nginx/sites-available/${DOMAIN}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:${APP_PORT}/socket.io/;
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

ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx

ufw allow 80/tcp 2>/dev/null || true
ufw allow 443/tcp 2>/dev/null || true

echo ""
echo "Nginx aktif — game bisa diakses via http://${DOMAIN} (setelah DNS aktif)"
echo ""

if [ -n "$EMAIL" ]; then
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || {
    echo "SSL gagal — pastikan DNS A record sudah mengarah ke IP VPS, lalu jalankan:"
    echo "  certbot --nginx -d $DOMAIN -d www.$DOMAIN"
  }
else
  echo "Untuk HTTPS, setelah DNS aktif jalankan:"
  echo "  SSL_EMAIL=email@kamu.com certbot --nginx -d $DOMAIN -d www.$DOMAIN"
fi

echo "Selesai."