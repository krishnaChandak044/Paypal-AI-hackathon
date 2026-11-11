"""Explicit SQLite schema version gate with small, additive migrations."""
from sqlalchemy import MetaData, inspect, text
from sqlalchemy.engine import Engine

SCHEMA_VERSION = 10


def ensure_schema(engine: Engine, metadata: MetaData) -> None:
    """Apply the local SQLite migration chain or initialize an empty PostgreSQL DB."""
    if engine.dialect.name == "postgresql":
        _ensure_postgres_schema(engine, metadata)
        return
    if engine.dialect.name != "sqlite":
        raise RuntimeError(f"Unsupported database dialect: {engine.dialect.name}")

    with engine.begin() as conn:
        version = conn.exec_driver_sql("PRAGMA user_version").scalar_one()

        if version == 0:
            existing = conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            ).fetchall()
            if existing:
                raise RuntimeError(
                    "Unversioned SQLite database found. Back it up and migrate explicitly before starting."
                )
            metadata.create_all(conn)
            conn.exec_driver_sql(f"PRAGMA user_version={SCHEMA_VERSION}")
            version = SCHEMA_VERSION

        elif version in (1, 2, 3, 4):
            for table_name in ("rate_buckets", "receipt_audits", "payouts", "subscriptions"):
                if table_name in metadata.tables:
                    metadata.tables[table_name].create(conn, checkfirst=True)
            version = 5

        if version == 5:
            payout_columns = {
                row[1] for row in conn.exec_driver_sql("PRAGMA table_info(payouts)").fetchall()
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
            version = 6

        if version == 6:
            # Preserve old simulated-success amounts as holds pending provider review.
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
            version = 7

        if version == 7:
            request_columns = {
                row[1] for row in conn.exec_driver_sql("PRAGMA table_info(aid_requests)").fetchall()
            }
            if "is_synthetic" not in request_columns:
                conn.exec_driver_sql(
                    "ALTER TABLE aid_requests ADD COLUMN is_synthetic BOOLEAN NOT NULL DEFAULT 0"
                )
            conn.exec_driver_sql("PRAGMA user_version=8")
            version = 8

        if version == 8:
            payout_columns = {
                row[1] for row in conn.exec_driver_sql("PRAGMA table_info(payouts)").fetchall()
            }
            for column, declaration in (
                ("sender_batch_id", "VARCHAR"),
                ("sender_item_id", "VARCHAR"),
                ("payout_item_id", "VARCHAR"),
                ("mode", "VARCHAR NOT NULL DEFAULT 'paypal_sandbox'"),
            ):
                if column not in payout_columns:
                    conn.exec_driver_sql(f"ALTER TABLE payouts ADD COLUMN {column} {declaration}")
            conn.exec_driver_sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_sender_batch_id "
                "ON payouts(sender_batch_id)"
            )
            conn.exec_driver_sql("PRAGMA user_version=9")
            version = 9

        if version == 9:
            payment_columns = {
                row[1] for row in conn.exec_driver_sql("PRAGMA table_info(payments)").fetchall()
            }
            if "refunded_minor" not in payment_columns:
                conn.exec_driver_sql(
                    "ALTER TABLE payments ADD COLUMN refunded_minor INTEGER NOT NULL DEFAULT 0"
                )
            for table_name in ("payment_disputes", "provider_refunds"):
                if table_name in metadata.tables:
                    metadata.tables[table_name].create(conn, checkfirst=True)
            conn.exec_driver_sql(f"PRAGMA user_version={SCHEMA_VERSION}")
            version = SCHEMA_VERSION

        if version != SCHEMA_VERSION:
            raise RuntimeError(
                f"Unsupported database schema version {version}; expected {SCHEMA_VERSION}"
            )


def _ensure_postgres_schema(engine: Engine, metadata: MetaData) -> None:
    """Initialize a fresh managed PostgreSQL database; never guess at legacy migrations."""
    with engine.begin() as conn:
        # Serialize simultaneous cold starts so create_all and the version row
        # are installed once, atomically, across Vercel function instances.
        conn.execute(text("SELECT pg_advisory_xact_lock(734921864201)"))
        tables = set(inspect(conn).get_table_names())
        marker = "reliefrail_schema_version"

        if marker in tables:
            version = conn.execute(
                text(f"SELECT version FROM {marker} WHERE id = 1 FOR UPDATE")
            ).scalar_one_or_none()
            if version != SCHEMA_VERSION:
                raise RuntimeError(
                    f"Unsupported PostgreSQL schema version {version}; expected {SCHEMA_VERSION}. "
                    "Back up the database and apply an explicit migration."
                )
            return

        app_tables = tables.intersection(metadata.tables)
        if app_tables:
            raise RuntimeError(
                "PostgreSQL contains ReliefRail tables but no schema version marker. "
                "Refusing to modify an unversioned database."
            )

        metadata.create_all(conn)
        conn.execute(
            text(
                f"CREATE TABLE {marker} "
                "(id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL)"
            )
        )
        conn.execute(
            text(f"INSERT INTO {marker} (id, version) VALUES (1, :version)"),
            {"version": SCHEMA_VERSION},
        )
