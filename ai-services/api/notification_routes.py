"""
SwarmAI — Notification Routes (Round 2)

POST /api/notifications/send  — send alert to selected responder teams
GET  /api/notifications/{incident_id} — fetch notification history
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from database.mongodb import notifications_collection, disaster_events_collection
from services.twilio_service import send_sms_alert, build_incident_sms

router = APIRouter(prefix="/api", tags=["Notifications"])


# ============================================================
# RESPONDER REGISTRY
# ============================================================

RESPONDER_LABELS = {
    "sos":       "SOS Contacts",
    "fire":      "Fire Brigade",
    "police":    "Police",
    "hospital":  "Hospital",
    "ambulance": "Ambulance Services",
}


# ============================================================
# REQUEST SCHEMA
# ============================================================

class NotificationRequest(BaseModel):
    incidentId: str = Field(..., description="Event ID of the incident")
    recipients: list[str] = Field(
        ...,
        description="List of recipient codes: sos, fire, police, hospital, ambulance"
    )
    message: str = Field(
        default="",
        description="Optional custom message to include"
    )


# ============================================================
# SEND NOTIFICATION
# ============================================================

@router.post("/notifications/send")
def send_notification(body: NotificationRequest):
    """
    Logs a notification dispatch to the notifications collection.
    In production this would trigger SMS / push / radio relay.
    """

    if not body.recipients:
        raise HTTPException(
            status_code=400,
            detail="At least one recipient must be selected."
        )

    # Resolve recipient labels
    resolved = []
    for code in body.recipients:
        label = RESPONDER_LABELS.get(code)
        if not label:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown recipient code: '{code}'. "
                       f"Valid codes: {list(RESPONDER_LABELS.keys())}"
            )
        resolved.append({"code": code, "label": label})

    notification_id = str(uuid.uuid4())

    record = {
        "notification_id":  notification_id,
        "incident_id":      body.incidentId,
        "recipients":       resolved,
        "message":          body.message or f"Emergency alert for incident {body.incidentId[:8].upper()}.",
        "status":           "dispatched",
        "dispatched_at":    datetime.now(timezone.utc),
    }

    try:
        notifications_collection.insert_one(record)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to persist notification: {e}"
        )

    print(
        f"📣 NOTIFICATION SENT | "
        f"Incident: {body.incidentId[:8].upper()} | "
        f"Recipients: {[r['label'] for r in resolved]}"
    )

    # --------------------------------------------------------
    # TWILIO SMS ALERT
    # Triggered only after a valid, persisted notification.
    # Failures are logged and never affect the incident workflow.
    # --------------------------------------------------------
    try:
        incident_doc = disaster_events_collection.find_one(
            {"event_id": body.incidentId}, {"_id": 0}
        ) or {}

        sms_body = build_incident_sms(
            incident_id=body.incidentId,
            disaster_type=incident_doc.get("disaster_type", "Unknown"),
            severity=incident_doc.get("severity"),
            location=incident_doc.get("location", "Unknown"),
            summary=incident_doc.get("summary", body.message),
        )

        twilio_result = send_sms_alert(sms_body)

        if twilio_result["success"]:
            for r in twilio_result.get("results", []):
                if r.get("success"):
                    print(f"📱 Twilio SMS dispatched | SID: {r.get('sid')} | To: {r.get('to')}")
                else:
                    print(f"⚠️ Twilio notification failed: {r.get('error')} | To: {r.get('to')}")
        else:
            print(f"⚠️ Twilio notification failed: {twilio_result.get('error')}")

    except Exception as twilio_exc:
        print(f"⚠️ Twilio notification failed: {twilio_exc}")

    return {
        "success":          True,
        "notificationId":   notification_id,
        "incidentId":       body.incidentId,
        "recipients":       resolved,
        "message":          record["message"],
        "dispatchedAt":     record["dispatched_at"].isoformat(),
    }


# ============================================================
# GET NOTIFICATION HISTORY
# ============================================================

@router.get("/notifications/{incident_id}")
def get_notifications(incident_id: str):
    """
    Returns notification history for a given incident.
    """

    try:
        records = list(
            notifications_collection.find(
                {"incident_id": incident_id},
                {"_id": 0}
            )
            .sort("dispatched_at", -1)
            .limit(20)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch notifications: {e}"
        )

    # Serialize datetimes
    for r in records:
        if isinstance(r.get("dispatched_at"), datetime):
            r["dispatched_at"] = r["dispatched_at"].isoformat()

    return {
        "incidentId":    incident_id,
        "notifications": records,
        "total":         len(records),
    }
