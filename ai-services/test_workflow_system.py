"""
SwarmAI — Workflow System Automated Unit & Integration Tests

Tests:
  1. Workflow Event Persistence
  2. Multi-incident Strict Data Isolation
  3. Server-side Filtering (Agent, Event Type, Status, Text Search)
  4. Workflow Summary Statistics
  5. Dynamic Workflow Graph Generation
"""

import sys
import os

if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

# Ensure ai-services directory is in python path
sys.path.insert(0, os.path.dirname(__file__))

from services.workflow_service import WorkflowService
from database.mongodb import workflow_events_collection, init_indexes


def run_tests():
    print("=" * 70)
    print("🧪 RUNNING WORKFLOW SYSTEM INTEGRATION TESTS")
    print("=" * 70)

    # Initialize indexes
    init_indexes()

    incident_a = f"test_inc_a_{os.urandom(4).hex()}"
    incident_b = f"test_inc_b_{os.urandom(4).hex()}"

    print(f"\n1. Recording Events for Incident A ({incident_a})...")
    e1 = WorkflowService.record_event(
        incident_id=incident_a,
        sender_agent_id="System",
        receiver_agent_id="CoordinatorAgent",
        event_type="incident_created",
        message="Flood reported in Central District",
        status="success",
        action="create_incident",
        metadata={"severity": 8}
    )
    assert e1 is not None, "Failed to record event e1"

    e2 = WorkflowService.record_event(
        incident_id=incident_a,
        sender_agent_id="CoordinatorAgent",
        receiver_agent_id="EmergencyAgent",
        event_type="agent_assigned",
        message="Assigned EmergencyAgent to dispatch rescue units",
        status="success",
        action="assign_agent"
    )
    assert e2 is not None, "Failed to record event e2"

    e3 = WorkflowService.record_event(
        incident_id=incident_a,
        sender_agent_id="EmergencyAgent",
        receiver_agent_id="MedicalAgent",
        event_type="agent_sent_message",
        message="Requesting 3 ambulances for evacuees",
        status="success",
        action="request_medical"
    )
    assert e3 is not None, "Failed to record event e3"

    print(f"2. Recording Events for Incident B ({incident_b})...")
    eb1 = WorkflowService.record_event(
        incident_id=incident_b,
        sender_agent_id="System",
        receiver_agent_id="CoordinatorAgent",
        event_type="incident_created",
        message="Fire reported in Industrial Zone",
        status="success",
        action="create_incident"
    )
    assert eb1 is not None, "Failed to record event eb1"

    print("\n3. Verifying Strict Incident Isolation...")
    res_a = WorkflowService.get_events(incident_id=incident_a)
    res_b = WorkflowService.get_events(incident_id=incident_b)

    assert res_a["total"] == 3, f"Expected 3 events for Incident A, got {res_a['total']}"
    assert res_b["total"] == 1, f"Expected 1 event for Incident B, got {res_b['total']}"

    # Verify no leak between incidents
    for event in res_a["events"]:
        assert event["incident_id"] == incident_a, f"Leak detected! Found incident_id {event['incident_id']} in query for {incident_a}"

    for event in res_b["events"]:
        assert event["incident_id"] == incident_b, f"Leak detected! Found incident_id {event['incident_id']} in query for {incident_b}"

    print("   ✅ Strict incident isolation verified successfully.")

    print("\n4. Verifying Server-Side Filtering & Text Search...")
    filtered_agent = WorkflowService.get_events(incident_id=incident_a, agent="EmergencyAgent")
    assert filtered_agent["total"] == 2, f"Expected 2 events involving EmergencyAgent, got {filtered_agent['total']}"

    filtered_search = WorkflowService.get_events(incident_id=incident_a, search="ambulances")
    assert filtered_search["total"] == 1, f"Expected 1 event for search 'ambulances', got {filtered_search['total']}"

    print("   ✅ Server-side filtering and text search verified successfully.")

    print("\n5. Verifying Workflow Summary...")
    summary_a = WorkflowService.get_summary(incident_id=incident_a)
    assert summary_a["total_events"] == 3, f"Summary total events mismatch: {summary_a['total_events']}"
    assert "EmergencyAgent" in summary_a["participating_agents"], "EmergencyAgent missing from participating agents"
    assert "MedicalAgent" in summary_a["participating_agents"], "MedicalAgent missing from participating agents"

    print("   ✅ Workflow summary verified successfully.")

    print("\n6. Verifying Dynamic Workflow Graph...")
    graph_a = WorkflowService.get_graph(incident_id=incident_a)
    assert len(graph_a["nodes"]) >= 3, f"Expected at least 3 nodes, got {len(graph_a['nodes'])}"
    assert len(graph_a["links"]) >= 2, f"Expected at least 2 links, got {len(graph_a['links'])}"

    link_sources = {l["source"] for l in graph_a["links"]}
    link_targets = {l["target"] for l in graph_a["links"]}
    assert "CoordinatorAgent" in link_sources or "EmergencyAgent" in link_sources, "Expected Coordinator/Emergency in link sources"

    print("   ✅ Dynamic workflow graph verified successfully.")

    # Cleanup test records
    workflow_events_collection.delete_many({"incident_id": {"$in": [incident_a, incident_b]}})
    print("\n🧹 Cleaned up test workflow records.")

    print("=" * 70)
    print("🎉 ALL WORKFLOW SYSTEM TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
