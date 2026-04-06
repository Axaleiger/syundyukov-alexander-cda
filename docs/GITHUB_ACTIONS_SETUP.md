# GitHub Actions: автоматический деплой на сервер

Кратко: после настройки секретов и SSH каждый **push** (в том числе после **merge PR**) в выбранные ветки запускает workflow **Deploy**, который по SSH заходит на ВМ, делает `git pull` и поднимает стек `docker compose` с прод-конфигом.

Текущий workflow: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

**Триггеры:**

- **Сервер (SSH):** только ветка **`server`** — см. [`deploy.yml`](../.github/workflows/deploy.yml).
- **GitHub Pages:** только ветка **`main`** — см. [`deploy-pages.yml`](../.github/workflows/deploy-pages.yml).

Очередь деплоев: **`concurrency`** с `cancel-in-progress: false` — параллельных сборок на сервере нет, лишние запуски ждут в очереди.

---

## Что уже должно быть на сервере

- Docker, клон этого репозитория, файл `.env` из `compose.env.example`, при необходимости TLS (см. операторский `SERVER_SETUP.md` на сервере, если он у вас ведётся).
- Пользователь деплоя (например `yc-user`) в группе **`docker`**.
- **`git pull`** без запроса пароля: **deploy key** (read) на репозиторий или **HTTPS + PAT** в `~/.git-credentials`.
- Путь к клону совпадает с секретом **`DEPLOY_PATH`** (например `/home/yc-user/app/syundyukov-alexander-cda`).

---

## Шаг 1. SSH-ключ только для GitHub Actions → сервер

На **локальной машине** (не на сервере), отдельная пара ключей:

```bash
ssh-keygen -t ed25519 -f ./gha_deploy -N '' -C "github-actions-deploy"
```

1. Файл **`gha_deploy.pub`** — **одной строкой** в `~/.ssh/authorized_keys` пользователя деплоя на сервере (например `yc-user`).
2. Содержимое **`gha_deploy`** (приватный ключ, включая `BEGIN` / `END`) — в секрет репозитория **`SSH_PRIVATE_KEY`**.

Проверка с вашего ПК:

```bash
ssh -i ./gha_deploy yc-user@<SSH_HOST>
```

---

## Шаг 2. Секреты в GitHub

Репозиторий → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Секрет | Пример | Назначение |
|--------|--------|------------|
| `SSH_HOST` | `158.160.149.143` | IP или DNS сервера |
| `SSH_USER` | `yc-user` | Пользователь SSH |
| `SSH_PRIVATE_KEY` | содержимое `gha_deploy` | Вход CI на сервер |
| `DEPLOY_PATH` | `/home/yc-user/app/syundyukov-alexander-cda` | Каталог с `docker-compose.yml` |

На **сервере** отдельно должен быть настроен доступ к GitHub для `git fetch`/`git pull` (deploy key или PAT).

---

## Шаг 3. Как запускается деплой

1. **Сайт на GitHub Pages:** merge в **`main`** → сборка и публикация Pages.
2. **Деплой на сервер:** merge в **`server`** (или push в `server`) → SSH-деплой на ВМ.
3. После push срабатывает соответствующий workflow (`deploy-pages.yml` или `deploy.yml`).
4. Job **Deploy** на сервере (упрощённо):

   ```bash
   cd "$DEPLOY_PATH"
   git fetch origin
   git checkout "$REF"
   git pull --ff-only origin "$REF"
   docker compose -f docker-compose.yml -f docker-compose.server.yml --env-file .env up -d --build
   ```

Логи: **Actions** → **Deploy** → последний запуск.

---

## Шаг 4. Сменить «деплойную» ветку

1. Задайте в команде правила merge (какая ветка — основная для релиза).
2. В `.github/workflows/deploy.yml` в `on.push.branches` перечислите нужные ветки.
3. Для пуша изменений в `.github/workflows/` при использовании HTTPS и PAT может понадобиться scope **`workflow`** у токена.

---

## Частые ошибки

| Симптом | Что проверить |
|---------|----------------|
| `Permission denied (publickey)` | Секрет `SSH_PRIVATE_KEY`, pubkey в `authorized_keys`, верный `SSH_USER` |
| `git pull` failed на сервере | Deploy key / PAT на **сервере** для GitHub |
| `docker: permission denied` | Пользователь в группе `docker` |
| Деплой не стартует | Ветка не в `deploy.yml`; push только в форк без merge в основной репозиторий |
| Долгая сборка | Первый `--build` тяжёлый; на слабой ВМ — swap, последовательная сборка (`scripts/deploy-server.sh`) |

---

## Ручной деплой без CI

```bash
cd ~/app/syundyukov-alexander-cda
git pull
./scripts/deploy-server.sh
```

После настройки секретов и ключей достаточно **merge в нужную ветку** — деплой на сервер идёт **автоматически** по workflow.
