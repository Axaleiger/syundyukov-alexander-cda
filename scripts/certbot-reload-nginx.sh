#!/bin/bash
# Вызывается из /usr/local/bin (deploy-hook certbot). Перезагрузка nginx в контейнере.
set -e
cd /home/yc-user/app/syundyukov-alexander-cda
sudo -u yc-user bash -c 'cd /home/yc-user/app/syundyukov-alexander-cda && docker compose -f docker-compose.yml -f docker-compose.server.yml --env-file .env exec -T nginx nginx -s reload'
