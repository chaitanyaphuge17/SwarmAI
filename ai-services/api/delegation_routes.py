"""
SwarmAI — Delegation Routes (Round 2)

POST /api/delegation/check    — run conflict check (no side-effects)
POST /api/delegation/confirm  — persist assignment (rejects high-severity conflicts)
GET  /api/delegation/{incident_id} — list assignments for an incident
GET  /api/delegation/teams    — list available teams
GET  /api/delegation/vehicles — list available vehicles
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from database.mongodb import assignments_collection

from services.conflict_checker import (
    check_conflicts,
    get_teams,
    get_vehicles,
)
from services.workflow_service import WorkflowService

router = APIRouter(prefix="/api", tags=["Delegation"])


# ============================================================
# REQUEST SCHEMAS
# ============================================================

class ConflictCheckRequest(BaseModel):
    incidentId: str
    teamId:     str
    vehicleId:  Optional[str] = ""
    task:       str
    startTime:  str   # ISO datetime string
    endTime:    str   # ISO datetime string


class DelegationConfirmRequest(BaseModel):
    incidentId: str
    teamId:     str
    vehicleId:  Optional[str] = ""
    task:       str
    startTime:  str
    endTime:    str
    override:   bool = Field(
        default=False,
        description="Set True to override medium-severity conflicts"
    )


# ============================================================
# HELPERS
# ============================================================

def _parse_dt(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid datetime format: '{value}'. Use ISO 8601."
        )


# ============================================================
# CHECK CONFLICT (no side-effects)
# ============================================================

@router.post("/delegation/check")
def check_delegation_conflict(body: ConflictCheckRequest):
    """
    Runs the conflict checker against active assignments.
    Does NOT persist anything.
    """

    start = _parse_dt(body.startTime)
    end   = _parse_dt(body.endTime)

    if end <= start:
        raise HTTPException(
            status_code=400,
            detail="End time must be after start time."
        )

    result = check_conflicts(
        team_id=body.teamId,
        vehicle_id=body.vehicleId or "",
        task=body.task,
        start_time=start,
        end_time=end,
        incident_id=body.incidentId,
    )

    print(
        f"🔍 CONFLICT CHECK | "
        f"Incident: {body.incidentId[:8].upper()} | "
        f"Team: {body.teamId} | "
        f"Has conflict: {result['hasConflict']} | "
        f"Severity: {result['severity']}"
    )

    return result


# ============================================================
# CONFIRM DELEGATION
# ============================================================

@router.post("/delegation/confirm")
def confirm_delegation(body: DelegationConfirmRequest):
    """
    Persists an assignment after conflict validation.
    Rejects if high-severity conflicts exist and override=False.
    """

    start = _parse_dt(body.startTime)
    end   = _parse_dt(body.endTime)

    if end <= start:
        raise HTTPException(
            status_code=400,
            detail="End time must be after start time."
        )

    # Run conflict check
    conflict_result = check_conflicts(
        team_id=body.teamId,
        vehicle_id=body.vehicleId or "",
        task=body.task,
        start_time=start,
        end_time=end,
        incident_id=body.incidentId,
    )

    # Block on high-severity unless override is set
    if (
        conflict_result["severity"] == "high"
        and not body.override
    ):
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    "High-severity conflicts detected. "
                    "Resolve conflicts or set override=true."
                ),
                "conflictResult": conflict_result,
            }
        )

    # Persist assignment
    assignment_id = str(uuid.uuid4())

    record = {
        "id":           assignment_id,
        "incidentId":   body.incidentId,
        "teamId":       body.teamId,
        "vehicleId":    body.vehicleId or "",
        "task":         body.task,
        "startTime":    start.isoformat(),
        "endTime":      end.isoformat(),
        "status":       "active",
        "override":     body.override,
        "conflictResult": conflict_result,
        "createdAt":    datetime.now(timezone.utc).isoformat(),
    }

    try:
        assignments_collection.insert_one(record)
        WorkflowService.record_event(
            incident_id=body.incidentId,
            sender_agent_id="Admin",
            receiver_agent_id=body.teamId,
            event_type="agent_assigned",
            message=f"Delegated task '{body.task}' to team {body.teamId}" + (f" with vehicle {body.vehicleId}" if body.vehicleId else "") + ".",
            status="active",
            action="delegate_task",
            result="assignment_confirmed",
            metadata={
                "teamId": body.teamId,
                "vehicleId": body.vehicleId,
                "task": body.task,
                "startTime": body.startTime,
                "endTime": body.endTime,
                "override": body.override,
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to persist assignment: {e}"
        )

    print(
        f"✅ DELEGATION CONFIRMED | "
        f"Assignment: {assignment_id[:8].upper()} | "
        f"Team: {body.teamId} | "
        f"Incident: {body.incidentId[:8].upper()}"
    )

    return {
        "success":          True,
        "assignmentId":     assignment_id,
        "incidentId":       body.incidentId,
        "teamId":           body.teamId,
        "vehicleId":        body.vehicleId,
        "task":             body.task,
        "startTime":        body.startTime,
        "endTime":          body.endTime,
        "status":           "active",
        "overridden":       body.override,
        "conflictsPresent": conflict_result["hasConflict"],
    }


# ============================================================
# GET ASSIGNMENTS FOR INCIDENT
# ============================================================

@router.get("/delegation/{incident_id}")
def get_assignments(incident_id: str):
    """
    Returns all assignments for a given incident.
    """

    try:
        records = list(
            assignments_collection.find(
                {"incidentId": incident_id},
                {"_id": 0}
            )
            .sort("createdAt", -1)
            .limit(20)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch assignments: {e}"
        )

    return {
        "incidentId":   incident_id,
        "assignments":  records,
        "total":        len(records),
    }


# ============================================================
# LIST TEAMS
# ============================================================

@router.get("/delegation-teams")
def list_teams():
    return {"teams": get_teams()}


# ============================================================
# LIST VEHICLES
# ============================================================

@router.get("/delegation-vehicles")
def list_vehicles():
    return {"vehicles": get_vehicles()}
