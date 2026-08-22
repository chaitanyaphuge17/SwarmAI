"""
SwarmAI — Workflow Service

Centralized recorder and manager for incident agent workflow events.
Persists structured events into MongoDB's workflow_events collection
and handles timeline queries, filter operations, summary statistics,
dynamic graph relationship generation, and real-time WebSocket broadcasting.
"""

import uuid
import logging
from datetime import datetime, timezone
from database.mongodb import workflow_events_collection, disaster_events_collection

logger = logging.getLogger("swarmai.workflow")

# AGENT ROLE MAPPINGS FOR RICH UX
AGENT_METADATA = {
    "System": {"role": "System Orchestrator", "type": "system"},
    "CoordinatorAgent": {"role": "Emergency Coordinator", "type": "coordinator"},
    "EmergencyAgent": {"role": "First Responder & Threat Assessor", "type": "emergency"},
    "TrafficAgent": {"role": "Route & Logistics Controller", "type": "traffic"},
    "MedicalAgent": {"role": "Casualty & Triage Specialist", "type": "medical"},
    "ResourceAgent": {"role": "Field Assets & Dispatch Officer", "type": "resource"},
    "Admin": {"role": "Human Command Officer", "type": "admin"},
}


class WorkflowService:
    @staticmethod
    def record_event(
        incident_id: str,
        sender_agent_id: str,
        receiver_agent_id: str = None,
        event_type: str = "agent_message",
        message: str = "",
        status: str = "success",
        action: str = None,
        result: str = None,
        metadata: dict = None,
    ) -> dict:
        """
        Centralized recording mechanism for workflow events.
        Creates a persistent record linked to incident_id.
        """
        if not incident_id:
            logger.warning("Workflow event skipped: missing incident_id")
            return None

        event_id = f"wfe_{uuid.uuid4().hex[:12]}"
        now_utc = datetime.now(timezone.utc)
        created_at_iso = now_utc.isoformat()

        sender_meta = AGENT_METADATA.get(sender_agent_id, {"role": sender_agent_id, "type": "agent"})
        receiver_meta = AGENT_METADATA.get(receiver_agent_id, {"role": receiver_agent_id, "type": "agent"}) if receiver_agent_id else None

        event_record = {
            "id": event_id,
            "incident_id": str(incident_id),
            "sender_agent_id": sender_agent_id,
            "sender_role": sender_meta["role"],
            "sender_type": sender_meta["type"],
            "receiver_agent_id": receiver_agent_id,
            "receiver_role": receiver_meta["role"] if receiver_meta else None,
            "receiver_type": receiver_meta["type"] if receiver_meta else None,
            "event_type": event_type,
            "message": message or "",
            "status": status or "success",
            "action": action,
            "result": result,
            "metadata": metadata or {},
            "created_at": created_at_iso,
        }

        try:
            workflow_events_collection.insert_one(event_record.copy())
            logger.info(f"Recorded workflow event [{event_type}] for incident {incident_id}: {sender_agent_id} -> {receiver_agent_id or 'ALL'}")
        except Exception as e:
            logger.error(f"Error persisting workflow event to MongoDB: {e}")

        # Broadcast event over WebSocket if broadcast utility available
        try:
            from api.disaster_routes import broadcast_disaster_data
            import asyncio
            payload = {
                "type": "workflow_event",
                "incident_id": str(incident_id),
                "event": event_record,
            }
            # Schedule async task if loop is running
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(broadcast_disaster_data(payload))
            except RuntimeError:
                pass
        except Exception as ws_err:
            logger.debug(f"WebSocket broadcast skipped or unavailable: {ws_err}")

        return event_record

    @staticmethod
    def get_events(
        incident_id: str,
        page: int = 1,
        limit: int = 50,
        agent: str = None,
        event_type: str = None,
        status: str = None,
        search: str = None,
    ) -> dict:
        """
        Retrieves paginated and filtered workflow events for a single incident ID.
        Guarantees strict incident isolation.
        """
        if not incident_id:
            return {"events": [], "total": 0, "page": page, "pages": 0}

        query = {"incident_id": str(incident_id)}

        if agent:
            query["$or"] = [{"sender_agent_id": agent}, {"receiver_agent_id": agent}]

        if event_type:
            query["event_type"] = event_type

        if status:
            query["status"] = status

        if search:
            regex_search = {"$regex": search, "$options": "i"}
            search_clause = [
                {"message": regex_search},
                {"action": regex_search},
                {"result": regex_search},
                {"sender_agent_id": regex_search},
                {"receiver_agent_id": regex_search},
            ]
            if "$or" in query:
                existing_or = query.pop("$or")
                query["$and"] = [{"$or": existing_or}, {"$or": search_clause}]
            else:
                query["$or"] = search_clause

        total = workflow_events_collection.count_documents(query)

        skip = max(0, (page - 1) * limit)
        cursor = (
            workflow_events_collection.find(query, {"_id": 0})
            .sort("created_at", 1)  # Chronological order
            .skip(skip)
            .limit(limit)
        )

        events = list(cursor)
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "events": events,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        }

    @staticmethod
    def get_summary(incident_id: str) -> dict:
        """
        Computes summary statistics and status for an incident workflow.
        """
        if not incident_id:
            return {}

        incident = disaster_events_collection.find_one({"event_id": str(incident_id)}, {"_id": 0})
        events = list(workflow_events_collection.find({"incident_id": str(incident_id)}, {"_id": 0}).sort("created_at", 1))

        if not events:
            return {
                "incident_id": incident_id,
                "disaster_type": incident.get("disaster_type") if incident else "Unknown",
                "status": incident.get("status") if incident else "pending",
                "location": incident.get("location") if incident else "Unknown",
                "created_at": incident.get("created_at") if incident else None,
                "updated_at": None,
                "active_agents": [],
                "participating_agents": [],
                "total_events": 0,
                "workflow_status": "initialized",
            }

        participating = set()
        active = set()
        status_changes = []

        for evt in events:
            sender = evt.get("sender_agent_id")
            receiver = evt.get("receiver_agent_id")

            if sender and sender != "System" and sender != "Admin":
                participating.add(sender)
                if evt.get("event_type") in ("agent_assigned", "agent_started", "agent_sent_message", "agent_action_performed"):
                    active.add(sender)

            if receiver and receiver != "System" and receiver != "Admin":
                participating.add(receiver)

            if evt.get("event_type") == "status_changed":
                status_changes.append(evt.get("result") or evt.get("message"))

        first_timestamp = events[0].get("created_at")
        last_timestamp = events[-1].get("created_at")

        # Determine current workflow status
        last_event_type = events[-1].get("event_type")
        if last_event_type == "incident_resolved" or (incident and incident.get("status") == "resolved"):
            workflow_status = "resolved"
        elif last_event_type in ("agent_action_failed", "incident_failed"):
            workflow_status = "failed"
        elif active:
            workflow_status = "in_progress"
        else:
            workflow_status = "completed"

        return {
            "incident_id": incident_id,
            "disaster_type": incident.get("disaster_type") if incident else (events[0].get("metadata", {}).get("disaster_type") or "Unknown"),
            "status": incident.get("status") if incident else "validated",
            "location": incident.get("location") if incident else (events[0].get("metadata", {}).get("location") or "Unknown"),
            "created_at": incident.get("created_at") if incident else first_timestamp,
            "updated_at": last_timestamp,
            "active_agents": sorted(list(active)),
            "participating_agents": sorted(list(participating)),
            "total_events": len(events),
            "workflow_status": workflow_status,
            "status_history": status_changes,
        }

    @staticmethod
    def get_graph(incident_id: str) -> dict:
        """
        Generates visual workflow graph structure (nodes & links) dynamically
        from actual persisted communication and action events for an incident.
        Does NOT hardcode agent relationships.
        """
        if not incident_id:
            return {"nodes": [], "links": []}

        events = list(workflow_events_collection.find({"incident_id": str(incident_id)}, {"_id": 0}))

        nodes_map = {}
        links_map = {}

        # Default system entry point node
        nodes_map["CoordinatorAgent"] = {
            "id": "CoordinatorAgent",
            "label": "Coordinator Agent",
            "role": AGENT_METADATA["CoordinatorAgent"]["role"],
            "type": "coordinator",
            "events_count": 0,
            "status": "active",
        }

        for evt in events:
            sender = evt.get("sender_agent_id")
            receiver = evt.get("receiver_agent_id")
            e_type = evt.get("event_type")
            status = evt.get("status", "success")

            if sender:
                if sender not in nodes_map:
                    meta = AGENT_METADATA.get(sender, {"role": sender, "type": "agent"})
                    nodes_map[sender] = {
                        "id": sender,
                        "label": sender,
                        "role": meta["role"],
                        "type": meta["type"],
                        "events_count": 0,
                        "status": "active",
                    }
                nodes_map[sender]["events_count"] += 1

            if receiver:
                if receiver not in nodes_map:
                    meta = AGENT_METADATA.get(receiver, {"role": receiver, "type": "agent"})
                    nodes_map[receiver] = {
                        "id": receiver,
                        "label": receiver,
                        "role": meta["role"],
                        "type": meta["type"],
                        "events_count": 0,
                        "status": "active",
                    }

                # Link between sender and receiver
                if sender and sender != receiver:
                    link_key = f"{sender}->{receiver}"
                    if link_key not in links_map:
                        links_map[link_key] = {
                            "source": sender,
                            "target": receiver,
                            "count": 0,
                            "event_types": set(),
                            "last_status": status,
                        }
                    links_map[link_key]["count"] += 1
                    links_map[link_key]["event_types"].add(e_type)
                    links_map[link_key]["last_status"] = status

        nodes = list(nodes_map.values())
        links = []
        for l in links_map.values():
            links.append({
                "source": l["source"],
                "target": l["target"],
                "count": l["count"],
                "event_types": sorted(list(l["event_types"])),
                "status": l["last_status"],
            })

        return {
            "incident_id": incident_id,
            "nodes": nodes,
            "links": links,
        }
