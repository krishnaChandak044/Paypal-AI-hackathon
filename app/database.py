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


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./reliefrail.db")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {
        "check_same_thread": False,
        "timeout": 30,
    }

engine = create_engine(DATABASE_URL, connect_args=connect_args)


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


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for obtaining a database session."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
