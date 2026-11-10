# ReliefRail backend

ReliefRail currently runs as a local SQLite service for fictional relief cases and PayPal sandbox payments. The source of truth is the SQLite database; AI returns drafts only. Deploying for real recipients requires an organization pilot, privacy review, and operational controls.

## Start

1. Use Python 3.11 or newer. Create a virtual environment and install `requirements.txt`.
2. Set a long random `BOOTSTRAP_SECRET` in the ignored `.env`. Keep the existing PayPal and Meta keys there.
3. Load `.env` into the shell (`set -a; source .env; set +a`) and run `uvicorn app.main:app --host 127.0.0.1 --port 8000`.
4. Open `/docs`. Call `POST /bootstrap` once with `X-Bootstrap-Secret`; store the admin bearer token securely. Create a campaign and members.
5. Register `/paypal/webhooks` with the sandbox app and set `PAYPAL_WEBHOOK_ID` to use independent payment confirmation. Subscribe to `PAYMENT.CAPTURE.COMPLETED` and `PAYMENT.CAPTURE.REFUNDED`.
6. Start `python -m app.worker` separately to inspect pending PayPal orders every five minutes. It does not credit funds on order status alone.

Enable `ENABLE_PUBLIC_INTAKE=true` only behind HTTPS and an abuse controlled reverse proxy. The SQLite rate limit allows five submissions per source IP per hour. Keep `TRUST_PROXY_IP=false` unless your proxy overwrites `X-Forwarded-For`. Enable `ALLOW_SYNTHETIC_AI=true` only for fictional requests.

## Operations

- `python -m app.maintenance backup /safe/path/reliefrail-backup.db` creates a SQLite consistent backup and checks integrity.
- `python -m app.maintenance redact-old --days 90` previews closed requests eligible for redaction. Add `--apply` to redact request text and revoke recipient tokens.
- `python -m app.recover` rotates the sole admin token if it is lost. Requires host access and `BOOTSTRAP_SECRET`.
- SQLite schema version is checked on startup. Version 1 upgrades to version 2 by adding intake rate buckets. Existing unversioned databases containing data are rejected to prevent a guessed migration.

Money amounts are integer minor units. A PayPal order becomes available only after its capture status, amount, and currency are verified. Manual spending remains unreconciled until a receipt is attached and a finance user approves it. Recipient access tokens are shown once and stored as hashes.

## Operational boundary

This is a single node backend. It needs deployment specific TLS, managed backups, monitoring, incident response, and review of real organization policies before handling actual disaster cases. The API does not offer legal compliance certification or automated eligibility decisions.
