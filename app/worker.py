"""Background worker for periodic payment status reconciliation."""
import asyncio
import logging

import httpx
from sqlalchemy import select

from .database import SessionLocal
from .models import Payment
from .payments import paypal_request

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


async def run_worker() -> None:
    """Runs the reconciliation loop every 5 minutes."""
    while True:
        await reconcile_pending_payments()
        await asyncio.sleep(300)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker())
