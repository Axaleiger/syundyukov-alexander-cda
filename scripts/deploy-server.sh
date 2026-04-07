#!/usr/bin/env bash
# Последовательная сборка без параллельных docker build (см. SERVER_SETUP.md).
# Запуск: из корня репозитория — ./scripts/deploy-server.sh

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Нет .env — скопируйте compose.env.example в .env и заполните." >&2
  exit 1
fi

COMPOSE=(docker compose -f docker-compose.server.yml --env-file .env)

if groups 2>/dev/null | grep -q '\bdocker\b'; then
  "${COMPOSE[@]}" build api
  "${COMPOSE[@]}" build nginx
  "${COMPOSE[@]}" up -d
else
  sg docker -c "cd $(printf '%q' "$ROOT") && docker compose -f docker-compose.server.yml --env-file .env build api"
  sg docker -c "cd $(printf '%q' "$ROOT") && docker compose -f docker-compose.server.yml --env-file .env build nginx"
  sg docker -c "cd $(printf '%q' "$ROOT") && docker compose -f docker-compose.server.yml --env-file .env up -d"
fi

echo "Готово. Проверка: curl -sS http://127.0.0.1:\${HTTP_PORT:-80}/api/health"
