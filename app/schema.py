"""Explicit SQLite schema version gate. Prevents silent mutation of an existing database."""
from sqlalchemy import MetaData
from sqlalchemy.engine import Engine

SCHEMA_VERSION = 3


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
                existing_names = {row[0] for row in existing_tables}
                expected_names = set(metadata.tables)
                has_rows = any(
                    conn.exec_driver_sql(f"SELECT COUNT(*) FROM {name}").scalar_one()
                    for name in existing_names
                )
                if existing_names != expected_names or has_rows:
                    raise RuntimeError(
                        "Unversioned SQLite database found. Back it up and migrate explicitly before starting."
                    )

            metadata.create_all(conn)
            conn.exec_driver_sql(f"PRAGMA user_version={SCHEMA_VERSION}")

        elif current_version == 1:
            metadata.tables["rate_buckets"].create(conn, checkfirst=True)
            if "receipt_audits" in metadata.tables:
                metadata.tables["receipt_audits"].create(conn, checkfirst=True)
            conn.exec_driver_sql(f"PRAGMA user_version={SCHEMA_VERSION}")

        elif current_version == 2:
            if "receipt_audits" in metadata.tables:
                metadata.tables["receipt_audits"].create(conn, checkfirst=True)
            conn.exec_driver_sql(f"PRAGMA user_version={SCHEMA_VERSION}")

        elif current_version != SCHEMA_VERSION:
            raise RuntimeError(
                f"Unsupported database schema version {current_version}; expected {SCHEMA_VERSION}"
            )
