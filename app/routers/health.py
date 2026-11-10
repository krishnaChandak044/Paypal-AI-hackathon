from fastapi import APIRouter

router = APIRouter(tags=["System Health"])


@router.get("/health")
def health_check():
    """Returns the operational status of the ReliefRail service."""
    return {"status": "ok"}

