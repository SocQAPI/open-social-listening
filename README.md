# Open Social Listening

Self-hosted social listening powered by the [SocQ API](https://socq.ai). Track a brand, its competitors and
keywords across Reddit, X, YouTube, TikTok, Instagram, LinkedIn, Threads, news and the web.

> Work in progress. This README is a developer stub; the product README comes with the UI.

## Run it

```bash
cp .env.example .env        # optional: put SOCQ_API_KEY here, or paste it in the app later
docker compose up -d        # http://localhost:3000, data in ./data
```

For development (Node.js 22+):

```bash
npm install
npm run dev                 # http://localhost:3000
npm test                    # unit tests
```

Without an API key the app seeds a demo project (fictional brand "Acme Notes") so every screen has data.

## Configuration

| Variable | Purpose |
| --- | --- |
| `SOCQ_API_KEY` | SocQ API key. Overrides the key saved on the Settings page. |
| `SOCQ_API_BASE` | SocQ API base URL, default `https://api.socq.ai`. |
| `DATABASE_URL` | libsql URL, default `file:./data/osl.db` (SQLite). `DATABASE_AUTH_TOKEN` for remote libsql. |
| `OSL_PASSWORD` | When set, every page and API route requires HTTP basic auth with this password. |
| `SMTP_URL`, `ALERT_FROM` | SMTP connection URL and sender for email alerts. |
| `OSL_DISABLE_SCHEDULER` | `1` stops the built-in scheduler; manual runs still work. |

## How it works

- **Sources** (`lib/sources/`): one file per SocQ search endpoint. Each builds the request input
  (results limit, time window, sort) and maps SocQ's normalized records to a mention.
- **Runner** (`lib/runner.ts`): for every enabled source × term it submits a SocQ task, polls it, stores
  new mentions (unique per project and URL), records the credits charged and sends spike alerts.
  A 401 pauses the project (`auth`), a 402 pauses it (`credits`), and a run that would exceed the monthly
  credit budget pauses it (`budget`).
- **Scheduler** (`lib/scheduler.ts`): started from `instrumentation.ts`; every minute it runs projects whose
  interval has elapsed. Searches only look back over the schedule window (hour / day / week) where the
  endpoint supports it; X and Threads rely on URL de-duplication.
- **Costs** (`lib/cost.ts`): estimates per run and per month from SocQ's per-result prices
  (1 credit = $0.005). Estimates are upper bounds; SocQ bills the records actually returned.
- **Storage** (`db/`): Drizzle ORM over libsql/SQLite. Migrations are SQL in `db/migrations.ts`, applied at startup.

### API

| Route | Purpose |
| --- | --- |
| `GET/POST /api/projects` | List or create projects |
| `GET/PATCH/DELETE /api/projects/:id` | Read, update (incl. `paused`) or delete a project |
| `POST /api/projects/:id/run` | Start a run now (202, runs in the background) |
| `GET/POST /api/projects/:id/alerts`, `PATCH/DELETE /api/alerts/:id`, `POST /api/alerts/:id/test` | Alert channels |
| `GET /api/mentions` | Filtered, cursor-paginated mentions |
| `PATCH /api/mentions/:id`, `POST /api/mentions/mark-read` | Star / read state |
| `GET /api/stats` | Daily volume, share of voice, sentiment, credits, recent runs |
| `GET /api/export` | CSV or JSON download |
| `GET/PUT /api/settings`, `GET /api/account` | API key and SocQ balance |
| `POST /api/estimate` | Credit estimate for a project draft |

## License

[MIT](LICENSE)
