#!/usr/bin/env bash
# Выпуск Let's Encrypt для публичного IPv4 (профиль shortlived, ~6 суток).
# Требуется: с интернета доступен HTTP к этому IP:80 (группа безопасности облака + ufw).
# После выпуска: renew_before_expiry = 1 day (~обновление на 5-й день), deploy-hook перезагружает nginx.
#
# Использование:
#   export LE_PUBLIC_IP=158.160.149.143   # при необходимости
#   sudo -E ./scripts/letsencrypt-ip-setup.sh
# Тест на staging:
#   sudo -E LE_STAGING=1 ./scripts/letsencrypt-ip-setup.sh

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IP="${LE_PUBLIC_IP:-158.160.149.143}"
WEBROOT="${LE_WEBROOT:-/var/www/certbot}"

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Запустите с sudo: sudo -E $0" >&2
  exit 1
fi

mkdir -p "$WEBROOT/.well-known/acme-challenge"
chmod -R a+rX "$WEBROOT"

install -m 755 "$ROOT/scripts/certbot-reload-nginx.sh" /usr/local/bin/certbot-reload-nginx.sh

if ! command -v certbot >/dev/null 2>&1; then
  echo "Нужен certbot (рекомендуется snap: snap install --classic certbot >= 5.4)." >&2
  exit 1
fi

EXTRA=()
if [[ -n "${LE_STAGING:-}" ]]; then
  EXTRA+=(--staging)
  echo "Режим STAGING (сертификат не доверен браузером)."
fi

certbot certonly \
  --preferred-profile shortlived \
  --webroot -w "$WEBROOT" \
  --ip-address "$IP" \
  --agree-tos \
  --non-interactive \
  --register-unsafely-without-email \
  --deploy-hook "/usr/local/bin/certbot-reload-nginx.sh" \
  "${EXTRA[@]}"

RENEWAL="/etc/letsencrypt/renewal/${IP}.conf"
if [[ -f "$RENEWAL" ]]; then
  if grep -q '^renew_before_expiry' "$RENEWAL"; then
    sed -i 's/^renew_before_expiry =.*/renew_before_expiry = 1 days/' "$RENEWAL"
  else
    sed -i '/^\[renewalparams\]/a renew_before_expiry = 1 days' "$RENEWAL"
  fi
fi

sed "s/158.160.149.143/${IP}/g" "$ROOT/docker/nginx/server-https.conf" > "$ROOT/docker/nginx/server.conf"
chown yc-user:yc-user "$ROOT/docker/nginx/server.conf" 2>/dev/null || true

cd "$ROOT"
sudo -u yc-user bash -c "cd $(printf '%q' "$ROOT") && docker compose -f docker-compose.server.yml --env-file .env up -d nginx"

echo "Готово. Проверка: curl -sk https://${IP}/api/health"
echo "Автообновление: systemd timer snap.certbot.renew.timer; интервал обновления задаётся renew_before_expiry (1 day ≈ пятый день при сроке ~6 суток)."
echo "Проверка без выпуска: sudo certbot renew --dry-run"
