# Production Deployment

## Overview

This project is deployed with Docker Compose on a DigitalOcean droplet.

- App directory: `/opt/follow-up-ai-calling-system`
- Branch: `main`
- App container: `app`
- Database container: `db`

## First-time server setup

1. Install Docker Engine and Docker Compose plugin on the droplet.
2. Clone the repository:
   `git clone https://github.com/Husnain-Ali-24/follow-up-ai-calling-system.git /opt/follow-up-ai-calling-system`
3. Create the production env file:
   `cp backend/.env.production.example backend/.env`
4. Fill in the production secrets in `backend/.env`.
5. Start the stack:
   `cd /opt/follow-up-ai-calling-system && bash scripts/deploy_production.sh`

## Manual deploy

Run this on the droplet:

```bash
cd /opt/follow-up-ai-calling-system
bash scripts/deploy_production.sh
```

## GitHub Actions secrets

Set these repository secrets before enabling automatic deploys:

- `PROD_HOST`: droplet IP or hostname
- `PROD_USER`: SSH user, for example `root`
- `PROD_PORT`: usually `22`
- `PROD_SSH_KEY`: private key for the deployment user
- `PROD_ENV_FILE`: full contents of `backend/.env` for production

## Verification

Useful commands on the droplet:

```bash
cd /opt/follow-up-ai-calling-system
docker compose ps
docker compose logs --tail=100 app
docker compose exec -T app python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health').read().decode())"
```
