"""Anonymized Geographic Need Cluster Map (Zero-PII Heatmap) Router."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import actor, campaign, require
from ..database import get_db
from ..geo_clusters import get_geographic_need_clusters
from ..models import Member
from ..schemas import GeoClustersResponseOut

router = APIRouter(tags=["Geographic Need Clusters & Zero-PII Heatmap"])


@router.get("/campaigns/{campaign_id}/geo/clusters", response_model=GeoClustersResponseOut)
def get_campaign_geographic_clusters(
    campaign_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Returns real-time sector-level need clusters and disbursement heatmaps across the disaster zone."""
    require(current_member)
    campaign(session, campaign_id, current_member)
    return get_geographic_need_clusters(session, campaign_id)
