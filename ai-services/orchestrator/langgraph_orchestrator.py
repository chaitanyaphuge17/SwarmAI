from typing import TypedDict, Annotated
import operator
import uuid

from langgraph.graph import StateGraph

from agents.emergency_agent import EmergencyAgent
from agents.traffic_agent import TrafficAgent
from agents.medical_agent import MedicalAgent
from agents.resource_agent import ResourceAgent

from shared.global_context import GlobalContext
from shared.communication_manager import CommunicationManager
from shared.memory_manager import MemoryManager
from services.workflow_service import WorkflowService
from services.cloudinary_service import delete_image_from_cloudinary


# ============================================================
# LANGGRAPH STATE
# ============================================================

class DisasterState(TypedDict):

    event: dict

    historical_context: list

    responses: Annotated[
        list,
        operator.add
    ]


# ============================================================
# SHARED SYSTEM COMPONENTS
# ============================================================

global_context = GlobalContext()

communication_manager = (
    CommunicationManager()
)

memory_manager = (
    MemoryManager()
)


shared_context = {

    "global_context":
        global_context,

    "communication_manager":
        communication_manager,

    "memory_manager":
        memory_manager,

    "historical_context":
        [],

    "websocket":
        None
}


# ============================================================
# AGENTS
# ============================================================

emergency_agent = EmergencyAgent()

traffic_agent = TrafficAgent()

medical_agent = MedicalAgent()

resource_agent = ResourceAgent()


# ============================================================
# EVENT NORMALIZATION
# ============================================================

def normalize_disaster_event(
    event: dict
) -> dict:

    """
    Convert AI-generated, real-world, simulated,
    or legacy disaster data into one standard format.

    Every event receives a unique event_id.
    """

    if not event:

        return {}


    # ========================================================
    # COPY EVENT
    # ========================================================

    event = dict(event)


    # ========================================================
    # EVENT ID
    # ========================================================

    event_id = event.get(
        "event_id"
    )


    if not event_id:

        event_id = str(
            uuid.uuid4()
        )

        print(
            f"🆔 Generated event_id: {event_id}"
        )

    else:

        print(
            f"🆔 Existing event_id: {event_id}"
        )


    # ========================================================
    # DISASTER TYPE
    # ========================================================

    disaster = event.get(
        "disaster"
    )


    if not disaster:

        disaster = event.get(
            "disaster_type",
            "Unknown Disaster"
        )


    # ========================================================
    # VICTIMS
    # ========================================================

    victim_estimate = event.get(
        "victim_estimate"
    )


    if victim_estimate is None:

        victims = event.get(
            "victims",
            0
        )

    else:

        victims = victim_estimate


    # ========================================================
    # TRAFFIC
    # ========================================================

    traffic_impact = event.get(
        "traffic_impact"
    )


    traffic_level = event.get(
        "traffic_level"
    )


    if traffic_level is None:

        traffic_mapping = {

            "low": 30,

            "medium": 60,

            "high": 85

        }


        traffic_level = (
            traffic_mapping.get(
                traffic_impact,
                0
            )
        )


    # ========================================================
    # LOCATION
    # ========================================================

    location = event.get(
        "location",
        "Unknown"
    )


    # ========================================================
    # LATITUDE
    # ========================================================

    latitude = event.get(
        "latitude"
    )


    if latitude is None:

        latitude = event.get(
            "lat"
        )


    # ========================================================
    # LONGITUDE
    # ========================================================

    longitude = event.get(
        "longitude"
    )


    if longitude is None:

        longitude = event.get(
            "lng"
        )


    # ========================================================
    # NORMALIZED EVENT
    # ========================================================

    normalized = {

        # Preserve all original fields
        **event,


        # ----------------------------------------------------
        # IDENTITY
        # ----------------------------------------------------

        "event_id":
            event_id,


        # ----------------------------------------------------
        # DISASTER
        # ----------------------------------------------------

        "disaster":
            disaster,


        "disaster_type":
            event.get(
                "disaster_type",
                disaster
            ),


        # ----------------------------------------------------
        # SEVERITY
        # ----------------------------------------------------

        "severity":
            event.get(
                "severity",
                0
            ),


        # ----------------------------------------------------
        # VICTIMS
        # ----------------------------------------------------

        "victims":
            victims,


        "victim_estimate":
            event.get(
                "victim_estimate"
            ),


        # ----------------------------------------------------
        # TRAFFIC
        # ----------------------------------------------------

        "traffic_level":
            traffic_level,


        "traffic_impact":
            event.get(
                "traffic_impact",
                "low"
            ),


        # ----------------------------------------------------
        # MEDICAL
        # ----------------------------------------------------

        "medical_access_impact":
            event.get(
                "medical_access_impact",
                "low"
            ),


        # ----------------------------------------------------
        # EVACUATION
        # ----------------------------------------------------

        "evacuation_required":
            event.get(
                "evacuation_required",
                False
            ),


        # ----------------------------------------------------
        # LOCATION
        # ----------------------------------------------------

        "location":
            location,


        # ----------------------------------------------------
        # COORDINATES
        # ----------------------------------------------------

        "latitude":
            latitude,

        "longitude":
            longitude

    }


    # ========================================================
    # DEBUG
    # ========================================================

    print(
        "\n" + "=" * 60
    )

    print(
        "📦 NORMALIZED DISASTER EVENT"
    )

    print(
        "=" * 60
    )

    print(
        f"🆔 Event ID: "
        f"{normalized['event_id']}"
    )

    print(
        f"🚨 Disaster: "
        f"{normalized['disaster']}"
    )

    print(
        f"⚠️ Severity: "
        f"{normalized['severity']}/10"
    )

    print(
        f"🚑 Victims: "
        f"{normalized['victims']}"
    )

    print(
        f"🚦 Traffic: "
        f"{normalized['traffic_impact']} "
        f"({normalized['traffic_level']})"
    )

    print(
        f"🏥 Medical access: "
        f"{normalized['medical_access_impact']}"
    )

    print(
        f"🚨 Evacuation: "
        f"{normalized['evacuation_required']}"
    )

    print(
        f"📍 Location: "
        f"{normalized['location']}"
    )

    print(
        f"🌐 Coordinates: "
        f"{normalized['latitude']}, "
        f"{normalized['longitude']}"
    )

    print(
        "=" * 60
    )


    return normalized


# ============================================================
# MEMORY RETRIEVAL NODE
# ============================================================

def memory_retrieval_node(
    state
):

    print(
        "\n" + "=" * 60
    )

    print(
        "🧠 MEMORY RETRIEVAL"
    )

    print(
        "=" * 60
    )


    event = state.get(
        "event",
        {}
    )


    if not event:

        print(
            "⚠️ No event available for memory retrieval"
        )

        shared_context[
            "historical_context"
        ] = []


        return {

            "historical_context":
                []

        }


    # ========================================================
    # RETRIEVE SIMILAR HISTORICAL EVENTS
    # ========================================================

    try:

        historical_context = (
            memory_manager.get_historical_context(
                event,
                limit=5
            )
        )


        if historical_context is None:

            historical_context = []


        # ====================================================
        # UPDATE SHARED CONTEXT
        # ====================================================

        shared_context[
            "historical_context"
        ] = historical_context


        # ====================================================
        # DEBUG
        # ====================================================

        if historical_context:

            print(
                f"📚 Found "
                f"{len(historical_context)} "
                f"historical event(s)"
            )


            for index, historical in enumerate(
                historical_context,
                start=1
            ):

                print(

                    f"\n[{index}] "

                    f"{historical.get('disaster_type', 'Unknown')} "

                    f"| "

                    f"{historical.get('location', 'Unknown')} "

                    f"| Severity "

                    f"{historical.get('severity', 0)}"

                )

        else:

            print(
                "📭 No relevant historical events found"
            )


        print(
            "=" * 60
        )


        return {

            "historical_context":
                historical_context

        }


    except Exception as e:

        print(
            "❌ Memory retrieval error:",
            e
        )


        shared_context[
            "historical_context"
        ] = []


        return {

            "historical_context":
                []

        }


# ============================================================
# AGENT EXECUTION
# ============================================================

def run_agent(
    agent,
    event,
    historical_context
):
    incident_id = event.get("event_id") if isinstance(event, dict) else None

    print(
        f"\n🤖 Running {agent.name}"
    )

    if incident_id:
        communication_manager.set_incident_id(incident_id)
        WorkflowService.record_event(
            incident_id=incident_id,
            sender_agent_id=agent.name,
            receiver_agent_id="CoordinatorAgent",
            event_type="agent_started",
            message=f"{agent.name} initialized disaster analysis and situational assessment.",
            status="success",
        )

    # ========================================================
    # MAKE CURRENT MEMORY AVAILABLE TO AGENT
    # ========================================================

    shared_context[
        "historical_context"
    ] = historical_context


    # ========================================================
    # ANALYSIS
    # ========================================================

    analysis = agent.analyze(

        event,

        shared_context

    )


    print(
        f"🔎 {agent.name} ANALYSIS:",
        analysis
    )


    # ========================================================
    # DECISION
    # ========================================================

    decision = agent.decide(

        analysis

    )


    print(
        f"🧠 {agent.name} DECISION:",
        decision
    )


    # ========================================================
    # RESPONSE
    # ========================================================

    response = agent.respond(

        decision,

        event

    )


    print(
        f"📤 {agent.name} RESPONSE:",
        response
    )


    # ========================================================
    # GLOBAL CONTEXT
    # ========================================================

    global_context.update_context(

        agent.name,

        response

    )

    if incident_id:
        reasoning_str = ""
        if isinstance(response, dict):
            reasoning_str = response.get("reasoning", "")
        WorkflowService.record_event(
            incident_id=incident_id,
            sender_agent_id=agent.name,
            receiver_agent_id="CoordinatorAgent",
            event_type="agent_action_completed",
            message=f"{agent.name} recommendation: {decision}",
            status="success",
            action=str(decision),
            result=str(reasoning_str),
            metadata={"confidence": response.get("confidence") if isinstance(response, dict) else None},
        )

    return response


# ============================================================
# EMERGENCY NODE
# ============================================================

def emergency_node(
    state
):

    print(
        "\n🚨 EmergencyAgent executing..."
    )


    response = run_agent(

        emergency_agent,

        state["event"],

        state.get(
            "historical_context",
            []
        )

    )


    return {

        "responses": [

            {

                "EmergencyAgent":
                    response

            }

        ]

    }


# ============================================================
# TRAFFIC NODE
# ============================================================

def traffic_node(
    state
):

    print(
        "\n🚦 TrafficAgent executing..."
    )


    response = run_agent(

        traffic_agent,

        state["event"],

        state.get(
            "historical_context",
            []
        )

    )


    return {

        "responses": [

            {

                "TrafficAgent":
                    response

            }

        ]

    }


# ============================================================
# MEDICAL NODE
# ============================================================

def medical_node(
    state
):

    print(
        "\n🏥 MedicalAgent executing..."
    )


    response = run_agent(

        medical_agent,

        state["event"],

        state.get(
            "historical_context",
            []
        )

    )


    return {

        "responses": [

            {

                "MedicalAgent":
                    response

            }

        ]

    }


# ============================================================
# RESOURCE NODE
# ============================================================

def resource_node(
    state
):

    print(
        "\n🚑 ResourceAgent executing..."
    )


    response = run_agent(

        resource_agent,

        state["event"],

        state.get(
            "historical_context",
            []
        )

    )


    return {

        "responses": [

            {

                "ResourceAgent":
                    response

            }

        ]

    }


# ============================================================
# COORDINATOR NODE
# ============================================================

def coordinator_node(
    state
):
    print(
        "\n🎯 CoordinatorAgent executing master swarm coordination..."
    )

    event = state.get("event", {})
    responses = state.get("responses", [])

    incident_id = event.get("event_id")
    lat = float(event.get("latitude") or 18.5204)
    lng = float(event.get("longitude") or 73.8567)
    disaster_type = event.get("disaster_type") or event.get("disaster") or "Emergency"

    coordinator_hub = {
        "name": "Incident Command HQ (CoordinatorAgent)",
        "lat": lat + 0.005,
        "lng": lng - 0.005,
        "type": "coordinator_hq",
        "role": "Master Command & Swarm Orchestration"
    }

    decision = {
        "action": f"Master coordination established for {disaster_type}. Synchronized multi-agent response.",
        "recommendation": "Maintain incident command post, optimize inter-agent communication, and dynamically monitor field deployments.",
        "command_center": coordinator_hub,
        "nearby_facilities": [coordinator_hub]
    }

    response = {
        "status": "success",
        "agent": "CoordinatorAgent",
        "analysis": {
            "status": "coordinated",
            "swarm_status": "Master Synchronization Active",
            "active_agents": len(responses) + 1
        },
        "decision": decision
    }

    if incident_id:
        WorkflowService.record_event(
            incident_id=incident_id,
            sender_agent_id="CoordinatorAgent",
            receiver_agent_id="System",
            event_type="plan_coordinated",
            message=f"CoordinatorAgent synthesized multi-agent response for {disaster_type}.",
            status="success",
        )

    return {
        "responses": [
            {
                "CoordinatorAgent": response
            }
        ]
    }


# ============================================================
# MEMORY STORAGE NODE
# ============================================================

def memory_storage_node(
    state
):

    print(
        "\n🧠 MemoryManager storing disaster..."
    )


    event = state.get(
        "event"
    )


    if not event:

        print(
            "⚠️ No event available for memory storage"
        )

        return {}


    # ========================================================
    # EVENT ID
    # ========================================================

    event_id = event.get(
        "event_id"
    )


    if not event_id:

        print(
            "❌ Memory storage skipped: "
            "event_id missing"
        )

        return {}


    # ========================================================
    # STORE EVENT
    # ========================================================

    try:

        memory_manager.store_event(
            event
        )


        print(
            f"🧠 Disaster memory stored: "
            f"{event_id}"
        )

        WorkflowService.record_event(
            incident_id=event_id,
            sender_agent_id="CoordinatorAgent",
            receiver_agent_id="System",
            event_type="incident_resolved",
            message="Multi-agent response plan finalized, synchronized, and stored to system memory.",
            status="success",
            action="finalize_plan",
            result="completed",
        )


    except Exception as e:

        print(
            "❌ Memory storage error:",
            e
        )

        # --------------------------------------------------------
        # CLOUDINARY ROLLBACK
        # If DB save failed, delete Cloudinary assets so they are
        # not orphaned (only if the event has cloudinary metadata)
        # --------------------------------------------------------
        cloudinary_images = event.get("cloudinary_images", [])
        if cloudinary_images:
            print(
                f"⚠️ DB save failed. Attempting to roll back "
                f"{len(cloudinary_images)} Cloudinary asset(s) for event {event_id}..."
            )
            for cld_img in cloudinary_images:
                pub_id = cld_img.get("public_id")
                if pub_id:
                    try:
                        delete_image_from_cloudinary(pub_id)
                    except Exception as rollback_err:
                        print(f"❌ Rollback failed for {pub_id}: {rollback_err}")


    print(
        "✅ Disaster memory operation completed"
    )


    return {}


# ============================================================
# BUILD LANGGRAPH
# ============================================================

builder = StateGraph(
    DisasterState
)


# ============================================================
# ADD NODES
# ============================================================

builder.add_node(
    "MemoryRetrieval",
    memory_retrieval_node
)

builder.add_node(
    "EmergencyAgent",
    emergency_node
)

builder.add_node(
    "TrafficAgent",
    traffic_node
)

builder.add_node(
    "MedicalAgent",
    medical_node
)

builder.add_node(
    "ResourceAgent",
    resource_node
)

builder.add_node(
    "CoordinatorAgent",
    coordinator_node
)

builder.add_node(
    "MemoryStorage",
    memory_storage_node
)


# ============================================================
# GRAPH FLOW
# ============================================================

builder.set_entry_point(
    "MemoryRetrieval"
)


# ============================================================
# MEMORY → EMERGENCY
# ============================================================

builder.add_edge(
    "MemoryRetrieval",
    "EmergencyAgent"
)


# ============================================================
# EMERGENCY → TRAFFIC
# ============================================================

builder.add_edge(
    "EmergencyAgent",
    "TrafficAgent"
)


# ============================================================
# EMERGENCY → MEDICAL
# ============================================================

builder.add_edge(
    "EmergencyAgent",
    "MedicalAgent"
)


# ============================================================
# TRAFFIC → RESOURCE
# ============================================================

builder.add_edge(
    "TrafficAgent",
    "ResourceAgent"
)


# ============================================================
# MEDICAL → RESOURCE
# ============================================================

builder.add_edge(
    "MedicalAgent",
    "ResourceAgent"
)


# ============================================================
# RESOURCE → COORDINATOR
# ============================================================

builder.add_edge(
    "ResourceAgent",
    "CoordinatorAgent"
)


# ============================================================
# COORDINATOR → MEMORY STORAGE
# ============================================================

builder.add_edge(
    "CoordinatorAgent",
    "MemoryStorage"
)


# ============================================================
# MEMORY STORAGE → END
# ============================================================

builder.set_finish_point(
    "MemoryStorage"
)


# ============================================================
# COMPILE GRAPH
# ============================================================

graph = builder.compile()


# ============================================================
# GRAPH INVOCATION
# ============================================================

def run_disaster(
    event: dict
):

    """
    Main entry point for every disaster.

    Flow:

        Incoming Event
              ↓
        Normalize Event
              ↓
        Retrieve Historical Memory
              ↓
        EmergencyAgent
           ↙        ↘
       Traffic     Medical
           ↘        ↙
          Resource
              ↓
        Store Current Event
              ↓
             END
    """


    # ========================================================
    # NORMALIZE
    # ========================================================

    normalized_event = (
        normalize_disaster_event(
            event
        )
    )


    if not normalized_event:

        raise ValueError(
            "Invalid disaster event"
        )


    # ========================================================
    # RESET RUN-SPECIFIC MEMORY
    # ========================================================

    shared_context[
        "historical_context"
    ] = []


    print(
        "\n" + "=" * 60
    )

    print(
        " DISASTER ORCHESTRATION STARTED"
    )

    print(
        "=" * 60
    )


    # ========================================================
    # INITIAL LANGGRAPH STATE
    # ========================================================

    initial_state = {

        "event":
            normalized_event,

        "historical_context":
            [],

        "responses":
            []

    }


    # ========================================================
    # EXECUTE GRAPH
    # ========================================================

    result = graph.invoke(
        initial_state
    )


    # ========================================================
    # GUARANTEE EVENT IN RESULT
    # ========================================================

    result["event"] = (
        normalized_event
    )


    # ========================================================
    # DEBUG
    # ========================================================

    historical_context = result.get(
        "historical_context",
        []
    )


    print(
        "\n Historical memory used:",
        len(historical_context)
    )


    print(
        "\n" + "=" * 60
    )

    print(
        " DISASTER ORCHESTRATION COMPLETED"
    )

    print(
        "=" * 60
    )


    return result