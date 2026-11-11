"""Background worker for periodic payment status reconciliation."""
import asyncio
import logging

import httpx
from sqlalchemy import select

from .database import SessionLocal
from .models import Payment, Payout
from .payments import paypal_request
from .payouts import apply_payout_status, get_paypal_payout_status

logger = logging.getLogger(__name__)


async def reconcile_pending_payments() -> None:
    """Checks pending PayPal orders and marks voided or expired orders accordingly."""
    with SessionLocal() as session:
        pending_payments = session.scalars(
            select(Payment).where(Payment.status == "pending")
        ).all()

        for payment in pending_payments:
            try:
                async with httpx.AsyncClient(timeout=20) as client:
                    data = await paypal_request(
                        client, "GET", f"/v2/checkout/orders/{payment.order_id}"
                    )

                status = data.get("status")
                if status == "VOIDED":
                    payment.status = "failed"
                elif status == "COMPLETED":
                    # The webhook or explicit capture endpoint must cryptographically verify capture details
                    # before available pool funds change. Never credit funds on order status alone.
                    pass

                session.commit()
            except (httpx.HTTPError, KeyError) as exc:
                logger.warning("Failed to reconcile payment %s: %s", payment.order_id, exc)
                session.rollback()


async def reconcile_pending_payouts() -> None:
    """Poll PayPal batches and settle/release reserved ledger amounts from item status."""
    with SessionLocal() as session:
        pending_payouts = session.scalars(
            select(Payout).where(
                Payout.mode == "paypal_sandbox",
                Payout.status.in_(("PENDING", "RECONCILIATION_REQUIRED")),
                Payout.payout_batch_id != Payout.sender_batch_id,
                Payout.payout_batch_id.is_not(None),
            )
        ).all()
        for payout in pending_payouts:
            if not payout.sender_item_id:
                continue
            try:
                result = await get_paypal_payout_status(payout.payout_batch_id, payout.sender_item_id)
                payout.payout_item_id = result.get("payout_item_id") or payout.payout_item_id
                apply_payout_status(session, payout, result["status"])
                session.commit()
            except (httpx.HTTPError, KeyError, ValueError) as exc:
                logger.warning("Failed to reconcile payout %s: %s", payout.id, exc)
                session.rollback()


async def run_worker() -> None:
    """Runs the reconciliation loop every 5 minutes."""
    while True:
        await reconcile_pending_payments()
        await reconcile_pending_payouts()
        await asyncio.sleep(300)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker())
