# WIMM (Where Is My Money) — Claude Code Configuration

## Environment

- **Runtime**: Alpine Linux container in WSL2, Docker daemon on Windows host
- **Docker socket**: `/var/run/docker.sock` (connects to Windows Docker)
- **Host mapping**: `D:\work` → `/workspace` (9p mount)
- **Tools need install each session**: `apk add docker-cli docker-cli-compose git`
- **GitHub**: repo `viviennebla/where-is-my-money`, user `viviennebla` (email `1569787845@qq.com`)
- **SSH keys**: stored at `/workspace/.ssh/id_ed25519` (persisted on Windows host, not in repo)
- **Git+SSH setup each session**:
  ```sh
  apk add git
  mkdir -p ~/.ssh && cp /workspace/.ssh/id_ed25519* ~/.ssh/ && chmod 600 ~/.ssh/id_ed25519
  git config --global user.email "1569787845@qq.com"
  git config --global user.name "viviennebla"
  ```

## Project

- **Repo**: `/workspace/where_is_money`
- **Stack**: FastAPI + SQLAlchemy async (aiosqlite) + React 18 + TypeScript + TailwindCSS
- **DB**: SQLite at `/app/data/wimm.db` (bind-mounted from `${HOST_PROJECT_ROOT}/data`)
- **.env** has `HOST_PROJECT_ROOT=D:\work\where_is_money` — required for Docker volume paths to work from WSL

## Docker Commands

```sh
# Rebuild (source is COPIED into images — must rebuild after any code change)
docker build --no-cache -t wimm-backend:dev -f backend/Dockerfile backend/
docker build --no-cache -t wimm-frontend:dev -f frontend/Dockerfile frontend/

# Start (use docker-compose with hyphen, not "docker compose")
docker-compose down
docker-compose up -d

# Status & health
docker-compose ps
docker exec where_is_money-backend-1 python -c "from urllib.request import urlopen; print(urlopen('http://localhost:8000/api/health').read())"

# Backend shell
docker exec where_is_money-backend-1 python -c "..."   # one-liner
docker exec -it where_is_money-backend-1 /bin/sh        # interactive

# Run tests (only when asked or debugging)
docker exec where_is_money-backend-1 python -m pytest -q
```

## Key Pitfalls

1. **SQLite can't ALTER COLUMN** — Must use `_migrate()` in `main.py` or drop + recreate table. New tables are auto-created by `Base.metadata.create_all`, but existing tables are NOT altered.
2. **Volume paths**: `docker-compose.yml` MUST use `${HOST_PROJECT_ROOT:-.}/data` not `./data`, otherwise Docker daemon on Windows can't resolve the WSL path.
3. **`docker-compose` (hyphen)** not `docker compose` (space) — the latter may not be installed.
4. **No wget in backend container** — use Python `urllib` for HTTP checks.

## Codebase Map

```
backend/app/
  main.py              — FastAPI app, lifespan, migrations
  database.py          — async_session, get_db
  auth.py              — JWT auth, get_current_user
  config.py            — Settings from env
  encryption.py        — API key encrypt/decrypt
  models/              — SQLAlchemy models (User, Account, Transaction, Tag, TagRule, ImportTemplate, ImportSession, TransactionTag)
  schemas/             — Pydantic schemas
  routers/             — auth, accounts, tags, tag_rules, transactions, import_pipeline, settings, tasks
  services/            — merge_engine, ai_classification, ai_inference, task_manager, balance_calculator
  utils/               — file_parser, sanitizer

frontend/src/
  api/client.ts        — Axios API client
  lib/types.ts         — TypeScript interfaces
  lib/constants.ts     — STANDARD_FIELDS, labels, colors
  stores/              — Zustand stores (authStore, filterStore)
  pages/               — Page components (Dashboard, Accounts, Import, Settings, Tags, TagRules)
  components/          — Reusable components (TransactionList, TransactionRow, TransactionEditor, etc.)
```

## Seeding Pattern

System defaults are seeded on-demand (not at startup):
- `seed_default_tag_rules(db)` — called in `_match_keyword_tags` and `GET /tag-rules`
- `seed_preset_templates(db)` — called in `GET /settings/templates`
- `seed_system_tags(db)` — called by `seed_default_tag_rules`

## Workflow Preferences

- **Don't auto-run tests** after every feature — only when asked or debugging
- **Execute tasks sequentially** in dependency order
- **After finishing features**: update `docs/技术实现-迭代记录.md` and check off `docs/ROADMAP.md`
- **Requirements changes**: update `需求文档.md`
- **Before major coding**: write design doc in `docs/`

## DeepSeek API Patterns

- No system role — merge into user message
- Response may have `thinking` blocks — skip them, only use `text` blocks
- 120s timeout, 4096 max_tokens
- Use `response_format: {"type": "json_object"}` for structured output
