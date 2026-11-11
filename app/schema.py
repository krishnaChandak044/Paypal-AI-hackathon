"""Explicit SQLite schema version gate. Prevents silent mutation of an existing database."""
from sqlalchemy import MetaData
from sqlalchemy.engine import Engine

SCHEMA_VERSION = 9


def ensure_schema(engine: Engine, metadata: MetaData) -> None:
    """Validates the SQLite user_version pragma against the expected application schema version."""
    if engine.dialect.name != "sqlite":
        raise RuntimeError("ReliefRail currently supports SQLite only")

    with engine.begin() as conn:
        current_version = conn.exec_driver_sql("PRAGMA user_version").scalar_one()

        if current_version == 0:
            existing_tables = conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            ).fetchall()
            if existing_tables:
                raise RuntimeError(
                    "Unversioned SQLite database found. Back it up and migrate explicitly before starting."
                )

            metadata.create_all(conn)
            conn.exec_driver_sql(f"PRAGMA user_version={SCHEMA_VERSION}")
            current_version = SCHEMA_VERSION

        elif current_version in (1, 2, 3, 4):
            if "rate_buckets" in metadata.tables:
                metadata.tables["rate_buckets"].create(conn, checkfirst=True)
            if "receipt_audits" in metadata.tables:
                metadata.tables["receipt_audits"].create(conn, checkfirst=True)
            if "payouts" in metadata.tables:
                metadata.tables["payouts"].create(conn, checkfirst=True)
            if "subscriptions" in metadata.tables:
                metadata.tables["subscriptions"].create(conn, checkfirst=True)
            current_version = 5

        if current_version == 5:
            payout_columns = {
                row[1]
                for row in conn.exec_driver_sql("PRAGMA table_info(payouts)").fetchall()
            }
            if "sender_batch_id" not in payout_columns:
                conn.exec_driver_sql("ALTER TABLE payouts ADD COLUMN sender_batch_id VARCHAR")
            if "sender_item_id" not in payout_columns:
                conn.exec_driver_sql("ALTER TABLE payouts ADD COLUMN sender_item_id VARCHAR")
            if "mode" not in payout_columns:
                conn.exec_driver_sql(
                    "ALTER TABLE payouts ADD COLUMN mode VARCHAR NOT NULL DEFAULT 'paypal_sandbox'"
                )
            conn.exec_driver_sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_sender_batch_id "
                "ON payouts(sender_batch_id)"
            )
            current_version = 6

        if current_version == 6:
            # Earlier versions inserted synthetic guardian subscriptions and recorded
            # simulated payout responses as SUCCESS. Preserve their amounts as holds
            # until an operator can reconcile them against PayPal sandbox records.
            conn.exec_driver_sql(
                "UPDATE ledger SET kind='reserve', reference=reference || '-legacy-reserved' "
                "WHERE kind='spend' AND id IN "
                "(SELECT ledger_id FROM payouts WHERE status='SUCCESS')"
            )
            conn.exec_driver_sql(
                "UPDATE payouts SET status='LEGACY_UNVERIFIED', mode='legacy_unverified' "
                "WHERE status='SUCCESS'"
            )
            conn.exec_driver_sql(
                "UPDATE subscriptions SET status='LEGACY_UNVERIFIED' WHERE status='ACTIVE'"
            )
            conn.exec_driver_sql("PRAGMA user_version=7")
            current_version = 7

        if current_version == 7:
            request_columns = {
                row[1]
                for row in conn.exec_driver_sql("PRAGMA table_info(aid_requests)").fetchall()
            }
            if "is_synthetic" not in request_columns:
                conn.exec_driver_sql(
                    "ALTER TABLE aid_requests ADD COLUMN is_synthetic BOOLEAN NOT NULL DEFAULT 0"
                )
            conn.exec_driver_sql("PRAGMA user_version=8")
            current_version = 8

        if current_version == 8:
            # Some earlier local databases had a version stamp ahead of the
            # payout columns because they were created by a development build.
            # Reconcile additive nullable provider identifiers safely.
            payout_columns = {
                row[1]
                for row in conn.exec_driver_sql("PRAGMA table_info(payouts)").fetchall()
            }
            if "sender_batch_id" not in payout_columns:
                conn.exec_driver_sql("ALTER TABLE payouts ADD COLUMN sender_batch_id VARCHAR")
            if "sender_item_id" not in payout_columns:
                conn.exec_driver_sql("ALTER TABLE payouts ADD COLUMN sender_item_id VARCHAR")
            if "payout_item_id" not in payout_columns:
                conn.exec_driver_sql("ALTER TABLE payouts ADD COLUMN payout_item_id VARCHAR")
            if "mode" not in payout_columns:
                conn.exec_driver_sql(
                    "ALTER TABLE payouts ADD COLUMN mode VARCHAR NOT NULL DEFAULT 'paypal_sandbox'"
                )
            conn.exec_driver_sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_sender_batch_id "
                "ON payouts(sender_batch_id)"
            )
            conn.exec_driver_sql(f"PRAGMA user_version={SCHEMA_VERSION}")
            current_version = SCHEMA_VERSION

        if current_version != SCHEMA_VERSION:
            raise RuntimeError(
                f"Unsupported database schema version {current_version}; expected {SCHEMA_VERSION}"
            )
