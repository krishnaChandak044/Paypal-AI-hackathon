"""Clearly labelled synthetic geographic scenario map router."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import actor, campaign, require
from ..database import get_db
from ..geo_clusters import get_geographic_need_clusters
from ..models import Member
from ..schemas import GeoClustersResponseOut

router = APIRouter(tags=["Synthetic Geographic Scenario Map"])


@router.get("/campaigns/{campaign_id}/geo/clusters", response_model=GeoClustersResponseOut)
def get_campaign_geographic_clusters(
    campaign_id: str,
    session: Session = Depends(get_db),
    current_member: Member = Depends(actor),
):
    """Returns static fictional scenario data; it is not a live campaign report."""
    require(current_member)
    campaign(session, campaign_id, current_member)
    return get_geographic_need_clusters(session, campaign_id)
