"""
SwarmAI — Incident Routes (Round 2)

Exposes disaster_events from MongoDB as /api/incidents endpoints
so the Admin Dashboard can display the incident queue.
"""

from fastapi import APIRouter, HTTPException

from shared.memory_manager import MemoryManager
from services.cloudinary_service import get_cloudinary_thumbnail

router = APIRouter(prefix="/api", tags=["Incidents"])


# ============================================================
# MEMORY MANAGER (reuse existing)
# ============================================================

try:
    _memory = MemoryManager()
except Exception:
    _memory = None


# ============================================================
# GET ALL INCIDENTS
# ============================================================

@router.get("/incidents")
def get_incidents(limit: int = 50):
    """
    Returns the most recent validated incidents
    from the disaster_events collection.
    """

    if not _memory:
        raise HTTPException(
            status_code=503,
            detail="Memory manager unavailable."
        )

    events = _memory.get_memory(limit=limit)

    # Normalise each event for the incident queue
    incidents = []

    for evt in events:

        # Only validated incidents appear in the queue
        status_val = str(evt.get("status", "")).lower()
        v_status = str(evt.get("validationStatus", "")).upper()
        if status_val == "validation_failed" or v_status == "VALIDATION_FAILED":
            continue

        incident_id = evt.get("event_id", "")

        severity_num = evt.get("severity", 0)

        if severity_num >= 8:
            severity_label = "critical"
        elif severity_num >= 5:
            severity_label = "high"
        elif severity_num >= 3:
            severity_label = "medium"
        else:
            severity_label = "low"

        image_url_raw = evt.get("imageUrl") or evt.get("image_url") or ""
        incidents.append({
            "id":                 incident_id,
            "short_id":           incident_id[:8].upper() if incident_id else "",
            "type":               evt.get("disaster_type") or evt.get("disaster", "Unknown"),
            "location":           evt.get("location", "Unknown"),
            "description":        evt.get("description", ""),
            "imageUrl":           image_url_raw,
            "thumbnailUrl":       get_cloudinary_thumbnail(image_url_raw),
            "severity":           severity_num,
            "severityLabel":      severity_label,
            "status":             evt.get("status", "validated"),
            "validationStatus":   evt.get("validationStatus", "VALIDATED"),
            "validatedAt":        str(evt.get("validatedAt") or evt.get("created_at", "")),
            "victims":            evt.get("victims") or evt.get("victim_estimate") or 0,
            "summary":            evt.get("summary", ""),
            "trafficImpact":      evt.get("traffic_impact", "low"),
            "medicalImpact":      evt.get("medical_access_impact", "low"),
            "evacuationRequired": evt.get("evacuation_required", False),
            "observations":       evt.get("observations", []),
            "hazards":            evt.get("hazards", []),
            "infrastructure":     evt.get("infrastructure_damage", []),
            "latitude":           evt.get("latitude"),
            "longitude":          evt.get("longitude"),
            "image_validation":   evt.get("image_validation", []),
            "total_images":       evt.get("total_images", 0),
            "valid_images":       evt.get("valid_images", 0),
            "rejected_images":    evt.get("rejected_images", 0),
            "cloudinary_images":  evt.get("cloudinary_images", []),
            "createdAt":          str(evt.get("created_at", "")),
        })

    return {"incidents": incidents, "total": len(incidents)}


# ============================================================
# GET SINGLE INCIDENT
# ============================================================

@router.get("/incidents/{event_id}")
def get_incident(event_id: str):
    """
    Returns a single incident by event_id.
    """

    if not _memory:
        raise HTTPException(
            status_code=503,
            detail="Memory manager unavailable."
        )

    evt = _memory.get_event(event_id)

    if not evt:
        raise HTTPException(
            status_code=404,
            detail=f"Incident {event_id} not found."
        )

    severity_num = evt.get("severity", 0)

    if severity_num >= 8:
        severity_label = "critical"
    elif severity_num >= 5:
        severity_label = "high"
    elif severity_num >= 3:
        severity_label = "medium"
    else:
        severity_label = "low"

    image_url_raw = evt.get("imageUrl") or evt.get("image_url") or ""
    return {
        "id":                 evt.get("event_id", ""),
        "short_id":           evt.get("event_id", "")[:8].upper() if evt.get("event_id") else "",
        "type":               evt.get("disaster_type") or evt.get("disaster", "Unknown"),
        "location":           evt.get("location", "Unknown"),
        "description":        evt.get("description", ""),
        "imageUrl":           image_url_raw,
        "thumbnailUrl":       get_cloudinary_thumbnail(image_url_raw),
        "severity":           severity_num,
        "severityLabel":      severity_label,
        "status":             evt.get("status", "validated"),
        "validationStatus":   evt.get("validationStatus", "VALIDATED"),
        "validatedAt":        str(evt.get("validatedAt") or evt.get("created_at", "")),
        "victims":            evt.get("victims") or evt.get("victim_estimate") or 0,
        "summary":            evt.get("summary", ""),
        "trafficImpact":      evt.get("traffic_impact", "low"),
        "medicalImpact":      evt.get("medical_access_impact", "low"),
        "evacuationRequired": evt.get("evacuation_required", False),
        "observations":       evt.get("observations", []),
        "hazards":            evt.get("hazards", []),
        "infrastructure":     evt.get("infrastructure_damage", []),
        "latitude":           evt.get("latitude"),
        "longitude":          evt.get("longitude"),
        "image_validation":   evt.get("image_validation", []),
        "total_images":       evt.get("total_images", 0),
        "valid_images":       evt.get("valid_images", 0),
        "rejected_images":    evt.get("rejected_images", 0),
        "cloudinary_images":  evt.get("cloudinary_images", []),
        "createdAt":          str(evt.get("created_at", "")),
    }

