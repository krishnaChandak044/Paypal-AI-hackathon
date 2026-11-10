"""Local admin token recovery script.

Requires direct access to the database host and knowledge of the BOOTSTRAP_SECRET.
"""
import getpass
import hashlib
import hmac
import os
import uuid

from sqlalchemy import select

from .database import SessionLocal
from .models import Member


def recover_admin_token() -> None:
    """Rotates the admin token if it was lost or compromised."""
    secret = os.getenv("BOOTSTRAP_SECRET")
    supplied = getpass.getpass("Bootstrap secret: ")

    if not secret or not hmac.compare_digest(secret, supplied):
        raise SystemExit("Access denied: Invalid bootstrap secret")

    with SessionLocal() as session:
        admins = session.scalars(select(Member).where(Member.role == "admin")).all()
        if len(admins) != 1:
            raise SystemExit("Recovery requires exactly one existing admin account")

        new_token = uuid.uuid4().hex + uuid.uuid4().hex
        admins[0].token_hash = hashlib.sha256(new_token.encode()).hexdigest()
        session.commit()

        print("New admin token (store securely; shown once):", new_token)


if __name__ == "__main__":
    recover_admin_token()
