# Vercel deployment (PostgreSQL)

ReliefRail supports SQLite for local development and PostgreSQL for Vercel.
The PostgreSQL schema initializer only initializes an empty database at the
current schema version; it deliberately refuses unversioned or older databases.
Do not point the deployment at the local reliefrail.db file.

## 1. Create the database

Create a managed PostgreSQL database (Neon is available through Vercel Storage
integrations). Configure DATABASE_URL in Vercel with the provider's pooled
connection string. The application accepts postgres://, postgresql://, and
postgresql+psycopg:// URLs. Keep the connection string private and use the
provider's pooled endpoint for serverless requests.

The first application startup creates the ReliefRail tables and records schema
version 10. If the deployment reports an unsupported or unversioned database,
stop and use a new empty database rather than deleting or modifying existing
data.

## 2. Import the Git repository into Vercel

- Import krishnaChandak044/Paypal-AI-hackathon with the repository root as
  the Vercel project root.
- Keep the detected FastAPI configuration. pyproject.toml identifies
  app.main:app; vercel.json builds the React bundle and includes it in the
  Python function.
- Add the environment variables below for Production and Preview as needed.
- Deploy once to obtain the public HTTPS domain.

Required environment variables:

| Variable | Value |
|---|---|
| DATABASE_URL | Pooled managed PostgreSQL URL |
| BOOTSTRAP_SECRET | Long random secret used once to create the initial admin |
| PAYPAL_ENVIRONMENT | sandbox |
| PAYPAL_API_BASE_URL | https://api-m.sandbox.paypal.com |
| PAYPAL_CLIENT_ID | PayPal Sandbox app client ID |
| PAYPAL_CLIENT_SECRET | PayPal Sandbox app secret |
| RELIEFRAIL_APP_URL | Deployed public HTTPS origin, without a trailing slash |
| ALLOW_SYNTHETIC_AI | false by default |
| ENABLE_PUBLIC_INTAKE | false unless intake abuse controls are configured |

Optional AI variables (only for synthetic demo cases):

| Variable | Value |
|---|---|
| AI_PROVIDER | meta |
| AI_MODEL | muse-spark-1.3 |
| META_MODEL_API_KEY | Meta Model API key |
| ALLOW_SYNTHETIC_AI | true only when intentionally demonstrating synthetic AI |

Do not set production PayPal credentials for this hackathon demo. Do not copy
the local .env, local SQLite database, or real request data into Vercel.

## 3. Create the initial operator

After the first deployment is healthy, create one organization and admin using
the protected bootstrap endpoint. Send BOOTSTRAP_SECRET as the
X-Bootstrap-Secret header and submit name and admin_name to
POST https://<deployment>/bootstrap. Save the returned admin_token
securely; it is shown only once. Bootstrap is one-time and subsequent attempts
return 409.

Use the app's key control to enter the admin bearer token. Create or select a
campaign, then populate only fictional records for a public demo. Never expose
the bootstrap secret or admin token in screenshots, source code, or the
submission page.

## 4. Configure PayPal webhooks

In the PayPal Developer Dashboard, register
https://<deployment>/paypal/webhooks on the Sandbox application. Subscribe
only to the event types handled by the app, then put the resulting webhook ID
in Vercel as PAYPAL_WEBHOOK_ID. Redeploy after changing environment
variables. Confirm webhook reachability and signature verification before
showing payment status as confirmed.

## 5. Validate the deployed demo

- Open /health and confirm status is ok.
- Open the frontend and verify the deployed build loads.
- Create and review synthetic requests with the admin token.
- Confirm the displayed PayPal mode is Sandbox.
- Run a small Sandbox checkout and verify the signed webhook and ledger event.
- Do not claim that live donations, real recipient records, or production
  disbursements are supported.

## Database migration

The application does not automatically copy or migrate data from the local
SQLite database to PostgreSQL. This is intentional: the local file may contain
private data, and the public demo should be initialized with fictional records.
SQLite backup/maintenance commands remain local SQLite tools.
