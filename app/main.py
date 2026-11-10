import os

from fastapi import FastAPI

from .auth import actor, campaign, log, recipient, require
from .database import Base, SessionLocal, engine, get_db, now, uid
from .ledger import balance, calculate_balance
from .models import (
    AidRequest,
    Audit,
    Campaign,
    ExceptionCase,
    Job,
    Ledger,
    Member,
    Need,
    Organization,
    Payment,
    RateBucket,
    Receipt,
    RecipientAccess,
    RequestRevision,
    Resource,
    WebhookEvent,
)
from .payments import amount_string, apply_capture, paypal, paypal_request
from .routers import (
    allocations,
    auth,
    campaigns,
    exceptions,
    health,
    payouts,
    paypal as paypal_router,
    receipts,
    recipient as recipient_router,
    requests,
    resources,
)
from .schema import ensure_schema

# Verify database schema version on application startup
ensure_schema(engine, Base.metadata)

app = FastAPI(
    title="ReliefRail API",
    version="0.2.0",
    description="Aid coordination and pooled fund accounting platform for community relief.",
)

# Trust proxy IP configuration for rate limiting behind reverse proxies
app.state.trust_proxy_ip = os.getenv("TRUST_PROXY_IP", "false").lower() == "true"

# Register modular API routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(campaigns.router)
app.include_router(requests.router)
app.include_router(allocations.router)
app.include_router(resources.router)
app.include_router(exceptions.router)
app.include_router(receipts.router)
app.include_router(recipient_router.router)
app.include_router(paypal_router.router)
app.include_router(payouts.router)

# Mount compiled modern frontend if built
try:
    from fastapi.staticfiles import StaticFiles
    dist_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web", "dist")
    if os.path.exists(dist_path):
        app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")
except Exception:
    pass

# Backwards compatibility alias for older imports:
db = get_db

__all__ = [
    "app",
    "engine",
    "SessionLocal",
    "Base",
    "get_db",
    "db",
    "now",
    "uid",
    "Organization",
    "Member",
    "Campaign",
    "AidRequest",
    "Need",
    "Ledger",
    "Payment",
    "WebhookEvent",
    "Audit",
    "Resource",
    "ExceptionCase",
    "RecipientAccess",
    "RequestRevision",
    "Receipt",
    "Job",
    "RateBucket",
    "actor",
    "require",
    "campaign",
    "log",
    "recipient",
    "calculate_balance",
    "balance",
    "paypal_request",
    "paypal",
    "apply_capture",
    "amount_string",
]
