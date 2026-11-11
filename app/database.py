import os
import uuid
from datetime import datetime, timezone
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def now() -> str:
    """Returns the current UTC timestamp as an ISO-8601 formatted string."""
    return datetime.now(timezone.utc).isoformat()


def uid() -> str:
    """Generates a UUID4 string."""
    return str(uuid.uuid4())


_configured_database_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
if os.getenv("VERCEL") == "1" and not _configured_database_url:
    raise RuntimeError("Set DATABASE_URL to a durable PostgreSQL connection before deploying on Vercel")
DATABASE_URL = _configured_database_url or "sqlite:///./reliefrail.db"

# Vercel's Postgres integrations expose postgres:// URLs; SQLAlchemy's
# psycopg 3 dialect requires the explicit driver name.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
if os.getenv("VERCEL") == "1" and not DATABASE_URL.startswith("postgresql+psycopg://"):
    raise RuntimeError("Vercel deployments require PostgreSQL; SQLite storage is not persistent there")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {
        "check_same_thread": False,
        "timeout": 30,
    }

engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("postgresql+psycopg://"):
    # Prefer a pooled provider URL (for example Neon pooled endpoint) in
    # serverless environments. Keep each warm function instance bounded.
    engine_options.update(pool_size=2, max_overflow=0, pool_recycle=300, pool_timeout=10)
engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_options)


@event.listens_for(engine, "connect")
def configure_sqlite_connection(dbapi_connection, connection_record) -> None:
    """Enforces SQLite integrity, concurrency pragmas, and foreign keys."""
    if engine.dialect.name == "sqlite":
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def lock_campaign_for_write(session: Session, campaign_model: type, campaign_id: str) -> None:
    """Serialize ledger mutations for one campaign on PostgreSQL.

    SQLite callers continue to use BEGIN IMMEDIATE. PostgreSQL callers lock
    the campaign row before reading balances and writing reservations/spends.
    """
    if engine.dialect.name == "postgresql":
        from sqlalchemy import select

        session.scalar(
            select(campaign_model)
            .where(campaign_model.id == campaign_id)
            .with_for_update()
        )


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for obtaining a database session."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
