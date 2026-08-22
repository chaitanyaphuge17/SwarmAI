"""
SwarmAI — Workflow Routes

API endpoints for the Incident Agent Workflow view in the Admin Panel.
Provides timeline retrieval, server-side filtering, workflow summary statistics,
and dynamic visual workflow graph generation.
"""

from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from services.workflow_service import WorkflowService

router = APIRouter(prefix="/api/incidents", tags=["Workflow"])


@router.get("/{incident_id}/workflow")
def get_incident_workflow(
    incident_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=200, description="Items per page"),
    agent: Optional[str] = Query(None, description="Filter by agent ID (e.g. EmergencyAgent)"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    status: Optional[str] = Query(None, description="Filter by status (success, pending, failed)"),
    search: Optional[str] = Query(None, description="Search term for message/action content"),
):
    """
    Returns a paginated list of chronological workflow events for a single incident ID.
    Strictly isolated to the specified incident.
    """
    if not incident_id:
        raise HTTPException(status_code=400, detail="Incident ID is required.")

    result = WorkflowService.get_events(
        incident_id=incident_id,
        page=page,
        limit=limit,
        agent=agent,
        event_type=event_type,
        status=status,
        search=search,
    )

    return result


@router.get("/{incident_id}/workflow/summary")
def get_incident_workflow_summary(incident_id: str):
    """
    Returns high-level workflow summary statistics for an incident:
    active agents, participating agents, total events, timestamps, and current workflow status.
    """
    if not incident_id:
        raise HTTPException(status_code=400, detail="Incident ID is required.")

    summary = WorkflowService.get_summary(incident_id=incident_id)
    if not summary:
        raise HTTPException(status_code=404, detail=f"No workflow data found for incident {incident_id}")

    return summary


@router.get("/{incident_id}/workflow/graph")
def get_incident_workflow_graph(incident_id: str):
    """
    Generates dynamic node and link data for the visual workflow graph
    representing actual agent relationships and communication count.
    """
    if not incident_id:
        raise HTTPException(status_code=400, detail="Incident ID is required.")

    graph_data = WorkflowService.get_graph(incident_id=incident_id)
    return graph_data
