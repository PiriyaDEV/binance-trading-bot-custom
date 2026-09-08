# Deploy notes — binance-trading-bot-custom

Personal notes from setting up and testing this bot locally, plus the plan for moving it to a cloud VM so it can run 24/7. Not an official repo doc — the canonical reference is [`docs/operations/deploy.md`](docs/operations/deploy.md) and [`deploy/README.md`](deploy/README.md).

## What we already did (local Docker on Mac)

1. Installed Docker Desktop via Homebrew: `brew install --cask docker-desktop` (had to launch the app once manually to finish setup — the brew cask install itself can't do that non-interactively).
2. Cloned the repo to `~/Desktop/Github/binance-trading-bot-custom`, checked out `feat/notify-and-bridge-scout`.
3. `cp .env.example .env`, then generated a real session secret:
   ```bash
   sed -i.bak "s|^AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -hex 32)|" .env && rm .env.bak
   ```
4. **Gotcha**: `.env.example`'s `DATABASE_URL` / `REDIS_URL` defaults point at `localhost:55432` / `localhost:56379` — that's for running the app _outside_ Docker against host-exposed ports. Inside Docker Compose those two lines override the compose file's own in-network defaults (`postgres:5432` / `redis:6379`), so the `app` container can't reach the database and crashes with `ECONNREFUSED`. **Fix: comment out both lines** in `.env` so Compose falls back to its own defaults:
   ```bash
   sed -i.bak 's|^DATABASE_URL=|#DATABASE_URL=|; s|^REDIS_URL=|#REDIS_URL=|' .env && rm .env.bak
   ```
5. Started the stack:
   ```bash
   docker compose -f deploy/compose/docker-compose.yml --env-file .env up -d
   ```
   All three services (`postgres`, `redis`, `app`) come up healthy; the app serves on `http://localhost` (port 80 → 3000 in-container).
6. Created the master account, created a Binance account in **test** mode, generated a key at [testnet.binance.vision](https://testnet.binance.vision) (log in with GitHub → "Generate HMAC_SHA256 Key"), pasted it into the account's API key page → verified green.
7. Created profile `pound-test`, strategy = Trailing Trade (default config), enabled the profile, then **added a symbol** (Home → profile → Add symbol → search `BTCUSDT` → Add symbol). This step is easy to miss: the strategy config's "Symbol" field is a per-symbol _override_, not the profile→symbol binding — a profile with strategy configured but zero symbols added will never trade (`"symbols":0` in the worker logs, "No symbols configured yet." on the Home page).
8. Confirmed it's actually trading: profile page → **Investigate** ("Why isn't it trading?") → green "Nothing is stopping this profile from trading" banner, an open BTCUSDT position, live unrealised P/L ticking on testnet (fake) money.

## Moving to a cloud VM (so it runs without the Mac staying on)

Docker Desktop needs the host machine awake, so a laptop that sleeps or shuts down kills the bot. The fix is a small always-on Linux VM running the same Docker Compose stack.

### Spec (per the repo's own install docs)

2 vCPU, 4 GB RAM, 20 GB disk. Any of these fit:

| Provider | Cost | Notes |
| --- | --- | --- |
| Oracle Cloud Free Tier | Free forever | 4 vCPU ARM / 24 GB RAM (Ampere shape) — plenty of headroom, but signup can hit "capacity unavailable" in some regions |
| DigitalOcean / Vultr / Linode | ~$6/mo | Fastest to get running, docs-matched droplet size available directly |
| Hetzner | ~€4–5/mo | Cheapest, slightly slower KYC/verification |

### Steps (mirrors what we did locally)

1. Provision the VM, get SSH access.
2. Install Docker + Compose plugin (official convenience script):
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. `git clone` this repo on the VM, checkout the branch/commit to run.
4. `cp .env.example .env`, generate `AUTH_SECRET`, **comment out `DATABASE_URL` / `REDIS_URL`** (see gotcha above), set `WEB_ORIGIN` to the VM's real address (or domain once TLS is set up).
5. For a real production run, follow the **production overlay** in `docs/operations/deploy.md` instead of the base compose file: generates `deploy/secrets/*` (session/postgres/redis passwords), layers `docker-compose.prod.yml` on top. The base stack we used locally is fine for continued testnet testing; the prod overlay adds the secrets-file pattern and is worth doing before ever pointing this at a **live** Binance account.
6. `docker compose -f deploy/compose/docker-compose.yml [-f docker-compose.prod.yml] --env-file .env up -d`
7. Put TLS in front of it if exposing it to the internet — Cloudflare Tunnel is the easiest (no port-forwarding, no exposed IP); nginx/Traefik reverse proxy is the alternative. See `deploy/README.md#tls-at-the-edge`.
8. Re-create the account / re-bind the testnet API key on the new instance (or restore a backup taken from the Mac instance — **System → Backup & restore** in the app).

### What I (Claude) can't do here

Sign up for a cloud account or enter payment details — that needs to happen in the user's own browser. Once there's SSH access to a box, I can drive the rest (install Docker, clone, configure `.env`, bring up the stack, debug) the same way we did locally.
