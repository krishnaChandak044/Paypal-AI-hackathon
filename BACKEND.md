# ReliefRail backend

ReliefRail currently runs as a local SQLite service for fictional relief cases and PayPal sandbox payments. The source of truth is the SQLite database; AI returns drafts only. Deploying for real recipients requires an organization pilot, privacy review, and operational controls.

## Start

1. Use Python 3.11 or newer. Create a virtual environment and install `requirements.txt`.
2. Set a long random `BOOTSTRAP_SECRET` in the ignored `.env`. Keep the existing PayPal and Meta keys there.
3. Load `.env` into the shell (`set -a; source .env; set +a`) and run `uvicorn app.main:app --host 127.0.0.1 --port 8000`.
4. Open `/docs`. Call `POST /bootstrap` once with `X-Bootstrap-Secret`; store the admin bearer token securely. Create a campaign and members.
5. Register `/paypal/webhooks` with the sandbox app and set `PAYPAL_WEBHOOK_ID`. Subscribe to `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`, `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`, `BILLING.SUBSCRIPTION.SUSPENDED`, `BILLING.SUBSCRIPTION.EXPIRED`, `PAYMENT.SALE.COMPLETED`, `PAYMENT.SALE.REFUNDED`, and `PAYMENT.SALE.REVERSED`.
6. For the three recurring sandbox plans, create active monthly plans matching the fixed tier amounts and campaign currency; configure the `PAYPAL_PLAN_*` IDs in `.env`. Subscriptions stay approval-pending and do not count until a verified PayPal event confirms them.

For a local fictional showcase, load `.env` in the API terminal (`set -a; source .env; set +a`) before starting the API. In a second repo-root terminal, load `.env` again and run `python -m app.demo_setup --confirm`. Store the printed one-time coordinator token in the app. It creates a separate demo campaign and synthetic requests only; it does not seed money, approvals, or payout records. Set `ALLOW_SYNTHETIC_AI=true` only in local `.env` to enable AI drafts for those synthetic requests.
7. Start `python -m app.worker` separately to inspect pending PayPal orders and payouts every five minutes. Payment order status alone never credits funds. Payout amounts stay reserved until an item-level provider success or failure is confirmed.

Enable `ENABLE_PUBLIC_INTAKE=true` only behind HTTPS and an abuse controlled reverse proxy. The SQLite rate limit allows five submissions per source IP per hour. Keep `TRUST_PROXY_IP=false` unless your proxy overwrites `X-Forwarded-For`. Enable `ALLOW_SYNTHETIC_AI=true` only for fictional requests.

## Operations

- `python -m app.maintenance backup /safe/path/reliefrail-backup.db` creates a SQLite consistent backup and checks integrity.
- `python -m app.maintenance redact-old --days 90` previews closed requests eligible for redaction. Add `--apply` to redact request text and revoke recipient tokens.
- `python -m app.recover` rotates the sole admin token if it is lost. Requires host access and `BOOTSTRAP_SECRET`.
- SQLite schema version is checked on startup. Supported earlier versions are migrated explicitly; unversioned databases containing data are rejected to prevent a guessed migration. Back up before upgrading.

Money amounts are integer minor units. A PayPal order becomes available only after its capture status, amount, and currency are verified. A payout holds the amount before the PayPal call; only an item-level PayPal success creates spend, and a provider failure releases the hold. Network ambiguity leaves a reconciliation hold rather than recording a false success. Manual spending remains unreconciled until a receipt is attached and a finance user approves it. Recipient access tokens are shown once and stored as hashes.

The geographic map uses static synthetic values and is not live campaign reporting. The runway, monthly subscription run rate, annual projection, and aid-pack count are estimates; projections are not cash available for disbursement.

## Operational boundary

This is a single node backend. It needs deployment specific TLS, managed backups, monitoring, incident response, and review of real organization policies before handling actual disaster cases. The API does not offer legal compliance certification or automated eligibility decisions.
