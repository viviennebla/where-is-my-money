# Where Is My Money (WIMM)

个人记账系统 — AI 驱动的账单导入与智能分类。

## Tech Stack

- **Frontend**: React 18 + TypeScript + TailwindCSS + Dexie.js + PWA
- **Backend**: FastAPI + SQLAlchemy + SQLite
- **AI**: DeepSeek API

## Quick Start

```sh
cp .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY
docker compose up -d
```

Backend: http://localhost:8000
Frontend: http://localhost:5173
