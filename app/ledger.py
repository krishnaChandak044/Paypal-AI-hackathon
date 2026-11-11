from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Ledger


class PoolBalance(TypedDict):
    confirmed_minor: int
    reserved_minor: int
    spent_minor: int
    available_minor: int
    deficit_minor: int


def calculate_balance(session: Session, campaign_id: str) -> PoolBalance:
    """Calculates the current fund breakdown for a campaign from immutable ledger events.

    Invariants:
    - confirmed = contributions - refunds
    - reserved = reserves - (releases + spends)
    - spent = spends
    - available = confirmed - reserved - spent
    """
    events = session.scalars(
        select(Ledger).where(Ledger.campaign_id == campaign_id)
    ).all()

    confirmed = sum(e.amount_minor for e in events if e.kind == "contribution") - sum(
        e.amount_minor for e in events if e.kind == "refund"
    )
    reserved = sum(e.amount_minor for e in events if e.kind == "reserve") - sum(
        e.amount_minor for e in events if e.kind in ("release", "spend")
    )
    spent = sum(e.amount_minor for e in events if e.kind == "spend")
    available = confirmed - reserved - spent

    return {
        "confirmed_minor": confirmed,
        "reserved_minor": reserved,
        "spent_minor": spent,
        "available_minor": available,
        "deficit_minor": max(0, -available),
    }


# Backwards compatibility alias
balance = calculate_balance

