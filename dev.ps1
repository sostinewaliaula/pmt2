#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Local development helper for the Caava PMT monorepo.

.DESCRIPTION
  Boots Postgres / Redis / RabbitMQ / MinIO + Django API in Docker (with
  source code volume-mounted so edits hot-reload), and runs the web
  frontend on the host via pnpm. No image rebuild is required after the
  first run.

  Run from the repo root: .\dev.ps1 <command>

.EXAMPLE
  .\dev.ps1 setup     # one-time: create .env files, generate keys
  .\dev.ps1 up        # start infra + API + workers
  .\dev.ps1 web       # run the web frontend on the host (Vite dev server)
  .\dev.ps1 logs api  # tail a service's logs
  .\dev.ps1 down      # stop everything (data persists)
  .\dev.ps1 nuke      # stop and wipe volumes (fresh DB)
#>

param(
  [Parameter(Position = 0)]
  [ValidateSet("setup", "up", "down", "restart", "logs", "ps", "migrate", "seed-widgets", "shell", "web", "nuke", "help")]
  [string]$Command = "help",

  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$Rest
)

$ErrorActionPreference = "Stop"

# Locate repo root (the folder containing this script)
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ComposeFile = Join-Path $RepoRoot "docker-compose-local.yml"
$Compose = @("compose", "-f", $ComposeFile)

function Write-Info($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[ok] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[warn] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[error] $msg" -ForegroundColor Red }

function Require-Tool($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Write-Err "$name is not on PATH. Install it and re-run."
    exit 1
  }
}

function New-RandomKey {
  $bytes = New-Object byte[] 50
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { '{0:x2}' -f ($_ -band 0xff) }) | Select-Object -First 1
}

function Set-EnvKey($path, $key, $value) {
  $lines = @()
  $found = $false
  if (Test-Path $path) {
    $lines = Get-Content -Raw $path -ErrorAction SilentlyContinue
    if ($null -eq $lines) { $lines = "" }
    $lines = $lines -split "`r?`n"
  }
  $out = foreach ($line in $lines) {
    if ($line -match "^\s*$key\s*=") {
      $found = $true
      "$key=$value"
    } else {
      $line
    }
  }
  if (-not $found) { $out += "$key=$value" }
  ($out -join "`n").TrimEnd() + "`n" | Set-Content -Path $path -NoNewline -Encoding UTF8
}

function Ensure-EnvFile($target, $template) {
  if (-not (Test-Path $target)) {
    if (-not (Test-Path $template)) {
      Write-Warn "Template missing: $template"
      return $false
    }
    Copy-Item $template $target
    Write-Ok "Created $target from $template"
    return $true
  }
  Write-Info "$target already exists, leaving it."
  return $false
}

function Cmd-Setup {
  Require-Tool docker

  $rootEnv = Join-Path $RepoRoot ".env"
  $apiEnv = Join-Path $RepoRoot "apps/api/.env"
  $webEnv = Join-Path $RepoRoot "apps/web/.env"

  Ensure-EnvFile $rootEnv (Join-Path $RepoRoot ".env.example") | Out-Null
  Ensure-EnvFile $apiEnv (Join-Path $RepoRoot "apps/api/.env.example") | Out-Null
  Ensure-EnvFile $webEnv (Join-Path $RepoRoot "apps/web/.env.example") | Out-Null

  Write-Info "Normalizing credentials so root .env (Postgres/RabbitMQ container init) matches apps/api/.env (Django connection)..."

  # Use the apps/api/.env defaults as the source of truth for service creds.
  $shared = @{
    "POSTGRES_USER"     = "plane"
    "POSTGRES_PASSWORD" = "plane"
    "POSTGRES_DB"       = "plane"
    "RABBITMQ_USER"     = "plane"
    "RABBITMQ_PASSWORD" = "plane"
    "RABBITMQ_VHOST"    = "plane"
    "AWS_ACCESS_KEY_ID"     = "access-key"
    "AWS_SECRET_ACCESS_KEY" = "secret-key"
    "AWS_S3_BUCKET_NAME"    = "uploads"
  }

  foreach ($k in $shared.Keys) {
    Set-EnvKey $rootEnv $k $shared[$k]
    Set-EnvKey $apiEnv $k $shared[$k]
  }

  # Generate persistent secrets for the API if missing
  $apiContent = Get-Content -Raw $apiEnv
  if ($apiContent -notmatch "(?m)^\s*SECRET_KEY\s*=\s*\S") {
    Set-EnvKey $apiEnv "SECRET_KEY" (New-RandomKey)
    Write-Ok "Generated SECRET_KEY"
  }
  if ($apiContent -notmatch "(?m)^\s*LIVE_SERVER_SECRET_KEY\s*=\s*\S") {
    Set-EnvKey $apiEnv "LIVE_SERVER_SECRET_KEY" (New-RandomKey)
    Write-Ok "Generated LIVE_SERVER_SECRET_KEY"
  }

  # Web URL the API uses in outbound emails should point at the Vite dev server
  Set-EnvKey $apiEnv "WEB_URL" "http://localhost:3000"
  Set-EnvKey $apiEnv "APP_BASE_URL" "http://localhost:3000"

  Write-Ok "Setup complete. Next: .\dev.ps1 up"
}

function Cmd-Up {
  Require-Tool docker
  if (-not (Test-Path (Join-Path $RepoRoot "apps/api/.env"))) {
    Write-Err "apps/api/.env is missing. Run: .\dev.ps1 setup"
    exit 1
  }

  Write-Info "Starting infra (postgres / redis / rabbitmq / minio)..."
  & docker @Compose up -d plane-db plane-redis plane-mq plane-minio
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Info "Running migrations (one-shot)..."
  & docker @Compose run --rm migrator
  if ($LASTEXITCODE -ne 0) {
    Write-Err "Migrator failed. Inspect the output above."
    exit $LASTEXITCODE
  }

  Write-Info "Starting API + workers (source is volume-mounted, hot reload enabled)..."
  & docker @Compose up -d api worker beat-worker
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host ""
  Write-Ok "Backend is up:"
  Write-Host "  - API:       http://localhost:8000"
  Write-Host "  - MinIO:     http://localhost:9090  (console)"
  Write-Host "  - Postgres:  localhost:5432"
  Write-Host ""
  Write-Host "Now run the web frontend on the host:"
  Write-Host "  .\dev.ps1 web" -ForegroundColor Yellow
}

function Cmd-Down {
  Require-Tool docker
  Write-Info "Stopping all services (data persists)..."
  & docker @Compose down
}

function Cmd-Restart {
  Require-Tool docker
  $svc = if ($Rest) { $Rest } else { @("api") }
  Write-Info "Restarting: $($svc -join ', ')"
  & docker @Compose restart @svc
}

function Cmd-Logs {
  Require-Tool docker
  $svc = if ($Rest) { $Rest } else { @() }
  & docker @Compose logs -f --tail=200 @svc
}

function Cmd-Ps {
  Require-Tool docker
  & docker @Compose ps
}

function Cmd-Migrate {
  Require-Tool docker
  Write-Info "Running migrations..."
  & docker @Compose run --rm migrator
}

function Cmd-SeedWidgets {
  Require-Tool docker
  Write-Info "Seeding default dashboard widgets..."
  & docker @Compose exec api python manage.py seed_widgets
}

function Cmd-Shell {
  Require-Tool docker
  $target = if ($Rest -and $Rest[0]) { $Rest[0] } else { "api" }
  Write-Info "Opening Django shell in service: $target"
  & docker @Compose exec $target python manage.py shell
}

function Cmd-Web {
  Require-Tool node
  Require-Tool npm
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Info "pnpm not found. Installing globally via npm..."
    npm install -g pnpm@10
  }

  Push-Location $RepoRoot
  try {
    if (-not (Test-Path (Join-Path $RepoRoot "node_modules"))) {
      Write-Info "Installing workspace dependencies (first time only)..."
      pnpm install
    }
    Write-Info "Starting Vite dev server (web on http://localhost:3000)..."
    pnpm dev
  } finally {
    Pop-Location
  }
}

function Cmd-Nuke {
  Require-Tool docker
  Write-Warn "This will DELETE the local Postgres, MinIO, Redis, RabbitMQ data."
  $reply = Read-Host "Type 'yes' to confirm"
  if ($reply -ne "yes") {
    Write-Info "Cancelled."
    return
  }
  & docker @Compose down -v
  Write-Ok "Volumes wiped. Run .\dev.ps1 up to start fresh."
}

function Cmd-Help {
  @"
Caava PMT — local dev helper

Usage:
  .\dev.ps1 setup              Create .env files and generate secret keys
  .\dev.ps1 up                 Start infra + API + workers (Docker)
  .\dev.ps1 web                Run the web frontend on the host (Vite)
  .\dev.ps1 logs [service]     Tail logs (default: all)
  .\dev.ps1 ps                 List service status
  .\dev.ps1 restart [service]  Restart a service (default: api)
  .\dev.ps1 migrate            Re-run database migrations
  .\dev.ps1 seed-widgets       Seed the default dashboard widget catalog
  .\dev.ps1 shell [service]    Open a Django shell (default: api)
  .\dev.ps1 down               Stop all services
  .\dev.ps1 nuke               Stop and wipe volumes (fresh DB)
  .\dev.ps1 help               Show this help

Recommended workflow:
  1. Terminal A:  .\dev.ps1 setup    (only the first time)
  2. Terminal A:  .\dev.ps1 up
  3. Terminal B:  .\dev.ps1 web
"@ | Write-Host
}

switch ($Command) {
  "setup" { Cmd-Setup }
  "up" { Cmd-Up }
  "down" { Cmd-Down }
  "restart" { Cmd-Restart }
  "logs" { Cmd-Logs }
  "ps" { Cmd-Ps }
  "migrate" { Cmd-Migrate }
  "seed-widgets" { Cmd-SeedWidgets }
  "shell" { Cmd-Shell }
  "web" { Cmd-Web }
  "nuke" { Cmd-Nuke }
  default { Cmd-Help }
}
