# Секреты GitHub Actions

Куда вносить: репозиторий → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.  
Имена секретов должны совпадать **точно** (регистр важен).

---

## Workflow «Deploy» (деплой на сервер, ветка `server`)

| Имя секрета | Значение |
|-------------|----------|
| `SSH_HOST` | `158.160.149.143` |
| `SSH_USER` | `yc-user` |
| `DEPLOY_PATH` | `/home/yc-user/app/syundyukov-alexander-cda` |
| `SSH_PRIVATE_KEY` | Полный текст **приватного** SSH-ключа, которым CI подключается к серверу (отдельная пара для деплоя, не личный ключ). Включая строки `-----BEGIN ... PRIVATE KEY-----` и `-----END ... PRIVATE KEY-----`. См. раздел про ключ в [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md). |

---

## Workflow «Deploy to GitHub Pages» (ветка `main`)

| Имя секрета | Значение |
|-------------|----------|
| `VITE_GROQ_API_KEY` | *(опционально)* API-ключ [Groq](https://console.groq.com) для ИИ-шагов в сборке. Если не задан — приложение соберётся со статическим fallback. |

---

## Безопасность

- Не коммить в git файлы с реальным `SSH_PRIVATE_KEY`, PAT или ключами API.
- При утечке ключа — отозвать в GitHub / на сервере удалить строку из `authorized_keys` и сгенерировать новую пару.
