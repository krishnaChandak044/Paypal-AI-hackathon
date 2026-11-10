import hashlib
import time

from fastapi import HTTPException, Request
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from .database import Base


class RateBucket(Base):
    __tablename__ = "rate_buckets"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    window: Mapped[int] = mapped_column(Integer)
    count: Mapped[int] = mapped_column(Integer)


def limit(
    request: Request,
    session: Session,
    scope: str,
    max_count: int,
    seconds: int,
) -> None:
    """Enforces sliding-window rate limiting on a per-IP basis.

    A deployment may set TRUST_PROXY_IP=true only when operating behind a
    trusted reverse proxy that overwrites X-Forwarded-For.
    """
    client_ip = request.client.host if request.client else "unknown"
    if getattr(request.app.state, "trust_proxy_ip", False):
        forwarded = request.headers.get("x-forwarded-for", client_ip)
        client_ip = forwarded.split(",")[0].strip()

    key = hashlib.sha256(f"{scope}:{client_ip}".encode()).hexdigest()
    window = int(time.time()) // seconds

    bucket = session.get(RateBucket, key)
    if not bucket:
        bucket = RateBucket(key=key, window=window, count=0)
        session.add(bucket)

    if bucket.window != window:
        bucket.window = window
        bucket.count = 0

    if bucket.count >= max_count:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again later.",
        )

    bucket.count += 1
    session.flush()
