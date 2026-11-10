"""SQLite backup, database integrity check, and retention redaction commands."""
import argparse
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select

from .database import SessionLocal
from .models import AidRequest, Audit, Campaign, RecipientAccess, RequestRevision


def get_sqlite_path() -> Path:
    """Extracts and resolves the local SQLite filesystem path from DATABASE_URL."""
    url = os.getenv("DATABASE_URL", "sqlite:///./reliefrail.db")
    if not url.startswith("sqlite:///"):
        raise SystemExit("SQLite database required for maintenance operations")
    return Path(url.removeprefix("sqlite:///")).resolve()


def backup_database(destination: str) -> None:
    """Creates a consistent online SQLite backup and executes PRAGMA integrity_check."""
    source_path = get_sqlite_path()
    output_path = Path(destination).resolve()

    if source_path == output_path:
        raise SystemExit("Destination path must differ from the source database")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(source_path) as source_conn, sqlite3.connect(output_path) as target_conn:
        source_conn.backup(target_conn)
        integrity = target_conn.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise SystemExit(f"Backup failed SQLite integrity check: {integrity}")

    output_path.chmod(0o600)
    print("Database backup complete:", output_path)


def redact_old_requests(days: int, dry_run: bool) -> None:
    """Redacts narrative details for closed requests older than the specified retention window."""
    if days < 1:
        raise SystemExit("Retention window days must be positive")

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    with SessionLocal() as session:
        old_requests = session.scalars(
            select(AidRequest).where(AidRequest.created_at < cutoff)
        ).all()

        targets = [
            req
            for req in old_requests
            if req.message != "[redacted]" and req.status in ("declined", "withdrawn")
        ]

        if dry_run:
            print(f"Eligible closed requests found: {len(targets)}")
            return

        for req in targets:
            req.message = "[redacted]"
            revisions = session.scalars(
                select(RequestRevision).where(RequestRevision.request_id == req.id)
            ).all()
            for rev in revisions:
                rev.message = "[redacted]"

            access = session.scalar(
                select(RecipientAccess).where(RecipientAccess.request_id == req.id)
            )
            if access:
                session.delete(access)

            campaign_obj = session.get(Campaign, req.campaign_id)
            org_id = campaign_obj.organization_id if campaign_obj else "unknown"

            session.add(
                Audit(
                    organization_id=org_id,
                    actor_id="maintenance",
                    action="request.retention_redacted",
                    entity_id=req.id,
                )
            )

        session.commit()
        print(f"Successfully redacted {len(targets)} closed request(s)")


def main() -> None:
    parser = argparse.ArgumentParser(description="ReliefRail database maintenance CLI")
    subparsers = parser.add_subparsers(dest="action", required=True)

    backup_parser = subparsers.add_parser("backup", help="Create a verified online backup")
    backup_parser.add_argument("destination", help="Destination file path for the backup")

    redact_parser = subparsers.add_parser("redact-old", help="Redact narrative data for aged closed requests")
    redact_parser.add_argument("--days", type=int, required=True, help="Retention period cutoff in days")
    redact_parser.add_argument("--apply", action="store_true", help="Apply redactions (default is dry-run)")

    args = parser.parse_args()

    if args.action == "backup":
        backup_database(args.destination)
    elif args.action == "redact-old":
        redact_old_requests(args.days, dry_run=not args.apply)


if __name__ == "__main__":
    main()
