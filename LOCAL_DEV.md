# Local development workflow

This is the iteration loop for working on the codebase **without rebuilding Docker images on every change**. Heavy infrastructure (Postgres, Redis, RabbitMQ, MinIO) and the Django API run in Docker with the source code volume-mounted, so Python edits hot-reload via `runserver`. The web frontend runs on the host with Vite for the fastest possible UI iteration.

The production flow (`docker-compose.yml` and the GitHub Action that builds images) is **untouched** — when you finish testing, `git push` and your existing pipeline runs as normal.

## Prerequisites

- **Docker Desktop** (Windows: with WSL2 backend)
- **Node 22+** — already on your PATH if `node --version` works
- **pnpm 10+** — installed automatically by `dev.ps1 web` if missing, or install yourself with `npm install -g pnpm@10`

You do **not** need Python installed locally. The API still runs in a container.

## First-time setup

From the repo root, in PowerShell:

```powershell
.\dev.ps1 setup
```

Or in Git Bash:

```bash
./dev.sh setup
```

What this does:
- Copies `.env.example` → `.env` at the repo root, in `apps/api/`, and in `apps/web/` (if missing).
- Normalizes Postgres and RabbitMQ credentials so the container init values match what Django connects with.
- Generates a persistent `SECRET_KEY` and `LIVE_SERVER_SECRET_KEY` so sessions survive restarts.
- Points the API's outbound link URLs at `http://localhost:3000` (the Vite dev server).

You only need to run `setup` once, or any time the `.env` files get out of sync.

## Daily loop

**Terminal 1 — backend** (boots once, then leave it running):

```powershell
.\dev.ps1 up
```

That command:
1. Boots `plane-db`, `plane-redis`, `plane-mq`, `plane-minio`.
2. Runs the migrator one-shot.
3. Boots `api`, `worker`, `beat-worker` with the source code volume-mounted from `apps/api/`.

The first run builds the API image (~3–5 minutes). After that, **Python edits trigger Django's auto-reloader inside the container** — no rebuild needed.

**Terminal 2 — web frontend**:

```powershell
.\dev.ps1 web
```

That installs workspace dependencies the first time, then runs `pnpm dev`, which boots Vite at `http://localhost:3000`. Vite hot-replaces TS/TSX/CSS modules in the browser as you save.

Open the app at **http://localhost:3000**. The Vite dev server proxies API calls through to `http://localhost:8000`.

## Common operations

| Task | Command |
| --- | --- |
| Tail API logs | `.\dev.ps1 logs api` |
| Tail all backend logs | `.\dev.ps1 logs` |
| Restart the API | `.\dev.ps1 restart api` |
| Re-run migrations after model changes | `.\dev.ps1 migrate` |
| Seed default dashboard widgets | `.\dev.ps1 seed-widgets` |
| Open a Django shell | `.\dev.ps1 shell` |
| List service status | `.\dev.ps1 ps` |
| Stop all backend services | `.\dev.ps1 down` |
| Wipe DB and start fresh | `.\dev.ps1 nuke` |

To run any other Django management command:

```powershell
docker compose -f docker-compose-local.yml exec api python manage.py <command>
```

## When does code reload, and when does it not?

| Change | Reloads automatically | Action needed |
| --- | --- | --- |
| Edit `apps/api/**/*.py` | yes (Django auto-reloader) | none |
| Edit `apps/web/**/*` or `packages/**/*` (TS/TSX/CSS) | yes (Vite HMR) | none |
| Add a new Python dependency to `requirements/*.txt` | no | rebuild the API image: `docker compose -f docker-compose-local.yml build api` |
| Add a new Django model / migration | no (auto-reload, but DB is unchanged) | `.\dev.ps1 migrate` |
| Add a new pnpm dependency to a `package.json` | no | `pnpm install` in the affected workspace |
| Change `docker-compose-local.yml` itself | no | `.\dev.ps1 down` then `.\dev.ps1 up` |

## URLs while running locally

| Service | URL |
| --- | --- |
| Web (Vite) | http://localhost:3000 |
| API (Django) | http://localhost:8000 |
| MinIO console | http://localhost:9090 |
| Postgres | localhost:5432 (user `plane`, db `plane`, password `plane`) |
| Redis | localhost:6379 |

## Pushing changes

When the change is ready:

```bash
git add ...
git commit -m "feat: ..."
git push
```

Your existing image-build action picks up the push and produces production images from `docker-compose.yml`. Nothing in the local-dev path interferes.

## Troubleshooting

- **`docker: command not found`** — Docker Desktop isn't running, or its CLI isn't on PATH.
- **API container exits immediately on first run** — most often missing/mismatched env values. Run `.\dev.ps1 setup` again to re-normalize, then `.\dev.ps1 up`.
- **Postgres "role 'plane' does not exist"** — your DB volume was created with old credentials. Run `.\dev.ps1 nuke` (destroys data) and `.\dev.ps1 up`.
- **Migrator fails with a missing column** — happens when an old DB is half-migrated. Inspect the traceback, then either fix the migration or `.\dev.ps1 nuke` to start clean.
- **Web shows but API calls 4xx/5xx** — `.\dev.ps1 logs api` for the traceback, and check the browser DevTools Network tab for the full response body.
- **Port already in use (5432 / 6379 / 8000 / 3000)** — something else on your machine is using that port. Stop it, or edit the host port in `docker-compose-local.yml` (left side of the `"5432:5432"` mapping).
