
import os
import io
import uuid
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from PIL import Image

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Form,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)

from services.disaster_analyzer import (
    analyze_disaster_image
)

from services.image_validator import (
    validate_disaster_images
)

from orchestrator.langgraph_orchestrator import (
    graph
)

from services.workflow_service import WorkflowService

from services.cloudinary_service import (
    upload_image_to_cloudinary,
    delete_image_from_cloudinary,
    CLOUDINARY_CLOUD_NAME,
)


router = APIRouter()

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)



# ============================================================
# CONFIGURATION
# ============================================================

MAX_IMAGE_SIZE = 10 * 1024 * 1024

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}


# ============================================================
# GEOCODING
# ============================================================

def geocode_location(location: str):

    try:

        print("\n🌍 GEOCODING LOCATION...")
        print(f"📍 Location: {location}")

        query = urllib.parse.urlencode({

            "q": location,

            "format": "json",

            "limit": 1

        })

        url = (

            "https://nominatim.openstreetmap.org/search?"

            + query

        )

        request = urllib.request.Request(

            url,

            headers={

                "User-Agent":
                    "SwarmAI-Disaster-System/1.0"

            }

        )

        with urllib.request.urlopen(

            request,

            timeout=10

        ) as response:

            data = json.loads(

                response.read().decode(
                    "utf-8"
                )

            )

        if not data:

            print(
                "⚠️ Location could not be geocoded"
            )

            return None, None

        latitude = float(
            data[0]["lat"]
        )

        longitude = float(
            data[0]["lon"]
        )

        print(
            f"📍 Coordinates: "
            f"{latitude}, {longitude}"
        )

        return latitude, longitude

    except Exception as e:

        print(
            "⚠️ GEOCODING ERROR:",
            e
        )

        return None, None


# ============================================================
# WEBSOCKET CLIENT MANAGER
# ============================================================

connected_clients = set()


# ============================================================
# BROADCAST
# ============================================================

async def broadcast_disaster_data(data):

    if not connected_clients:

        print(
            "⚠️ No WebSocket clients connected"
        )

        return

    disconnected = set()

    print(
        f"📡 Broadcasting to "
        f"{len(connected_clients)} client(s)"
    )

    for websocket in connected_clients:

        try:

            await websocket.send_json(
                data
            )

            print(
                "✅ WebSocket payload sent"
            )

        except Exception as e:

            print(
                "❌ WebSocket broadcast error:",
                e
            )

            disconnected.add(
                websocket
            )

    for websocket in disconnected:

        connected_clients.discard(
            websocket
        )


# ============================================================
# WEBSOCKET
# ============================================================

@router.websocket("/ws/disaster")
async def disaster_websocket(
    websocket: WebSocket
):

    print(
        "\n🔌 Incoming WebSocket connection..."
    )

    print(
        f"🌐 Client: {websocket.client}"
    )

    try:

        # ----------------------------------------------------
        # ACCEPT CONNECTION
        # ----------------------------------------------------

        await websocket.accept()

        connected_clients.add(
            websocket
        )

        print(
            "✅ WebSocket CONNECTED"
        )

        print(
            f"👥 Connected clients: "
            f"{len(connected_clients)}"
        )

        # ----------------------------------------------------
        # CONNECTION MESSAGE
        # ----------------------------------------------------

        await websocket.send_json({

            "type":
                "connection",

            "status":
                "connected",

            "message":
                "SwarmAI disaster monitoring connected."

        })

        # ----------------------------------------------------
        # KEEP CONNECTION ALIVE
        # ----------------------------------------------------

        while True:

            message = await websocket.receive_text()

            print(
                "📨 WebSocket message:",
                message
            )

    except WebSocketDisconnect:

        print(
            "🔌 WebSocket client disconnected"
        )

    except Exception as e:

        print(
            "❌ WebSocket ERROR:",
            e
        )

    finally:

        connected_clients.discard(
            websocket
        )

        print(
            f"👥 Connected clients: "
            f"{len(connected_clients)}"
        )


# ============================================================
# DISASTER ANALYSIS
# ============================================================

@router.post("/disaster/analyze")
async def analyze_disaster(

    location: str = Form(...),

    description: str = Form(""),

    disaster_type: str = Form(None),

    disasterType: str = Form(None),

    images: list[UploadFile] = File(...)

):

    print("\n")
    print("=" * 70)

    print(
        "🚨 NEW MULTI-IMAGE DISASTER INPUT RECEIVED"
    )

    print("=" * 70)


    # ========================================================
    # PRE-GENERATE EVENT ID
    # ========================================================

    event_id = str(uuid.uuid4())


    # ========================================================
    # LOCATION VALIDATION
    # ========================================================

    location = location.strip()

    if not location:

        raise HTTPException(

            status_code=400,

            detail="Disaster location is required."

        )

    print(
        f"📍 Location: {location}"
    )


    # ========================================================
    # DESCRIPTION & DISASTER TYPE
    # ========================================================

    description = description.strip()

    user_disaster_type = (disaster_type or disasterType or "").strip()

    print(
        f"📝 Description: {description}"
    )

    if user_disaster_type:
        print(f"🏷️ User Selected Disaster Type: {user_disaster_type}")


    # ========================================================
    # IMAGE COUNT VALIDATION
    # ========================================================

    if not images:

        raise HTTPException(

            status_code=400,

            detail="At least one disaster image is required."

        )

    if len(images) > 5:

        raise HTTPException(

            status_code=400,

            detail="Maximum 5 images per request are allowed."

        )

    print(
        f"📷 Total uploaded images: "
        f"{len(images)}"
    )


    # ========================================================
    # STEP 1: READ IMAGES INTO MEMORY & FILE-LEVEL CHECKS
    # (No disk save yet — validation happens first)
    # ========================================================

    prepared_images = []   # images that passed file-level checks (have bytes)
    upload_validation = [] # per-image file-level rejection records

    for index, image in enumerate(
        images,
        start=1
    ):

        print("\n")
        print(
            f"📷 READING IMAGE {index}"
        )

        filename = (
            image.filename
            or
            f"image_{index}"
        )

        content_type = image.content_type


        # ----------------------------------------------------
        # CONTENT TYPE
        # ----------------------------------------------------

        if not content_type:

            upload_validation.append({
                "image_index": index,
                "filename": filename,
                "accepted": False,
                "reason": "Unable to determine image type."
            })

            print(f"   ❌ Rejected — unknown content type")
            continue


        if content_type not in ALLOWED_IMAGE_TYPES:

            upload_validation.append({
                "image_index": index,
                "filename": filename,
                "accepted": False,
                "reason": "Unsupported image format. Please upload JPG, PNG, or WEBP."
            })

            print(f"   ❌ Rejected — unsupported type: {content_type}")
            continue


        # ----------------------------------------------------
        # READ IMAGE BYTES
        # ----------------------------------------------------

        try:
            image_bytes = await image.read()
        except Exception as e:
            print("❌ IMAGE READ ERROR:", e)
            upload_validation.append({
                "image_index": index,
                "filename": filename,
                "accepted": False,
                "reason": "Unable to read uploaded image."
            })
            continue


        # ----------------------------------------------------
        # EMPTY IMAGE
        # ----------------------------------------------------

        if len(image_bytes) == 0:
            upload_validation.append({
                "image_index": index,
                "filename": filename,
                "accepted": False,
                "reason": "Uploaded image is empty."
            })
            print(f"   ❌ Rejected — empty file")
            continue


        # ----------------------------------------------------
        # IMAGE SIZE
        # ----------------------------------------------------

        if len(image_bytes) > MAX_IMAGE_SIZE:
            upload_validation.append({
                "image_index": index,
                "filename": filename,
                "accepted": False,
                "reason": "Image exceeds the 10 MB limit."
            })
            print(f"   ❌ Rejected — exceeds 10MB ({len(image_bytes)} bytes)")
            continue


        # ----------------------------------------------------
        # BYTE-LEVEL PILLOW INTEGRITY CHECK
        # ----------------------------------------------------

        try:
            with Image.open(io.BytesIO(image_bytes)) as pil_img:
                pil_img.verify()
        except Exception as decode_err:
            print("❌ IMAGE DECODE ERROR:", decode_err)
            upload_validation.append({
                "image_index": index,
                "filename": filename,
                "accepted": False,
                "reason": "Corrupted image file. Please upload a valid image (JPG, PNG, or WEBP)."
            })
            continue


        # ----------------------------------------------------
        # PASSES FILE-LEVEL CHECKS — QUEUE FOR VISION VALIDATION
        # (NOT saved to disk yet)
        # ----------------------------------------------------

        print(f"   ✅ File OK — {filename} ({len(image_bytes)} bytes, {content_type})")

        prepared_images.append({
            "image_index": index,
            "filename": filename,
            "content_type": content_type,
            "image_bytes": image_bytes,
        })


    # ========================================================
    # STEP 2: EARLY EXIT IF NO IMAGES PASSED FILE CHECKS
    # ========================================================

    if not prepared_images:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "No images passed file validation. Please upload a valid JPG, PNG, or WEBP under 10 MB.",
                "rejected_details": upload_validation
            }
        )


    # ========================================================
    # STEP 3: LOCAL VISION MODEL + GEOGRAPHIC VALIDATION
    # Run IMMEDIATELY — before saving to disk or calling Groq.
    # ========================================================

    print("\n")
    print("=" * 70)
    print("🔍 RUNNING LOCAL VISION + GROQ GEO-CONSISTENCY VALIDATION")
    print("=" * 70)

    validation_summary = await validate_disaster_images(
        images=prepared_images,
        location=location,
        user_description=description,
        reported_disaster=user_disaster_type,
    )

    # --------------------------------------------------------
    # If ALL images rejected — return 422 immediately.
    # Do NOT save to disk. Do NOT call Groq.
    # --------------------------------------------------------

    if validation_summary["accepted_images"] == 0:
        print("❌ ALL IMAGES REJECTED — returning HTTP 422 immediately")
        print("=" * 70)
        raise HTTPException(
            status_code=422,
            detail={
                "message": "None of the uploaded images passed disaster validation.",
                "total_images": validation_summary["total_images"],
                "accepted_images": 0,
                "rejected_images": validation_summary["rejected_images"],
                "rejected_details": validation_summary["rejected_details"],
                "overall_geographic_status": validation_summary["overall_geographic_status"],
            }
        )

    accepted_indices = {item["image_index"] for item in validation_summary["accepted_details"]}
    rejected_images = validation_summary["rejected_details"]


    # ========================================================
    # STEP 4: UPLOAD ACCEPTED IMAGES TO CLOUDINARY
    # (Falls back to local disk save if Cloudinary is not configured)
    # ========================================================

    valid_images = []
    _cloudinary_uploaded_public_ids = []  # for rollback if orchestration fails

    for img in prepared_images:
        if img["image_index"] not in accepted_indices:
            continue

        filename = img["filename"]
        image_bytes = img["image_bytes"]
        content_type = img["content_type"]
        index = img["image_index"]
        cloudinary_meta = None

        # --------------------------------------------------------
        # ATTEMPT CLOUDINARY UPLOAD
        # --------------------------------------------------------
        if CLOUDINARY_CLOUD_NAME:
            try:
                upload_filename = f"incident_{event_id[:8]}_{index}_{filename}"
                cloudinary_meta = upload_image_to_cloudinary(
                    image_bytes=image_bytes,
                    filename=upload_filename,
                )
                image_url = cloudinary_meta["secure_url"]
                _cloudinary_uploaded_public_ids.append(cloudinary_meta["public_id"])
                print(f"☁️ Cloudinary upload OK: {image_url}")
            except Exception as cloud_err:
                print(f"⚠️ Cloudinary upload failed for image {index}, falling back to local: {cloud_err}")
                cloudinary_meta = None
                # Fall back to local save
                file_ext = os.path.splitext(filename)[1].lower() or ".jpg"
                saved_filename = f"incident_{event_id[:8]}_{index}{file_ext}"
                saved_path = os.path.join(UPLOADS_DIR, saved_filename)
                try:
                    with open(saved_path, "wb") as f_out:
                        f_out.write(image_bytes)
                    image_url = f"/uploads/{saved_filename}"
                    print(f"💾 Fallback local save: {image_url}")
                except Exception as save_err:
                    print("⚠️ Failed to save image locally:", save_err)
                    image_url = ""
        else:
            # --------------------------------------------------------
            # LOCAL DISK SAVE (no Cloudinary credentials)
            # --------------------------------------------------------
            file_ext = os.path.splitext(filename)[1].lower() or ".jpg"
            saved_filename = f"incident_{event_id[:8]}_{index}{file_ext}"
            saved_path = os.path.join(UPLOADS_DIR, saved_filename)
            try:
                with open(saved_path, "wb") as f_out:
                    f_out.write(image_bytes)
                image_url = f"/uploads/{saved_filename}"
                print(f"💾 Saved accepted image: {saved_path} -> {image_url}")
            except Exception as save_err:
                print("⚠️ Failed to save image to uploads:", save_err)
                image_url = ""

        valid_images.append({
            "image_index": index,
            "filename": filename,
            "content_type": content_type,
            "image_bytes": image_bytes,
            "image_url": image_url,
            "cloudinary_metadata": cloudinary_meta,
        })


    print(
        f"\n✅ Validation complete — {len(valid_images)} accepted, "
        f"{len(rejected_images)} rejected"
    )


    # ========================================================
    # AI DISASTER ANALYSIS
    # ========================================================

    print("\n")
    print("=" * 70)

    print(
        "🧠 SENDING VALID IMAGES "
        "TO DISASTER ANALYZER"
    )

    print("=" * 70)


    try:

        analysis = (

            await analyze_disaster_image(

                images=valid_images,

                location=location,

                description=description

            )

        )

    except Exception as e:

        print(
            "\n❌ DISASTER AI ANALYSIS FAILED"
        )

        print(
            "Error:",
            e
        )

        raise HTTPException(

            status_code=502,

            detail={
                "message":
                    "The AI analysis service could not process the request.",
                "error": str(e)
            }

        )


    # Preserving analyzer relevance result without hardcoding to True


    # ========================================================
    # LOG AI ANALYSIS
    # ========================================================

    print(
        "\n🧠 FINAL AI ANALYSIS:"
    )

    print(

        json.dumps(

            analysis,

            indent=2,

            default=str

        )

    )


    # ========================================================
    # GEOCODING
    # ========================================================

    latitude, longitude = (

        geocode_location(
            location
        )

    )


    # ========================================================
    # NORMALIZE AI DATA
    # ========================================================

    disaster_type = user_disaster_type or analysis.get(

        "disaster_type",

        "Unknown Disaster"

    )


    severity = analysis.get(

        "severity",

        0

    )


    confidence = analysis.get(

        "confidence",

        0

    )


    victim_estimate = analysis.get(
        "victim_estimate"
    )


    traffic_impact = analysis.get(

        "traffic_impact",

        "low"

    )


    traffic_mapping = {

        "low":
            30,

        "medium":
            60,

        "high":
            85

    }


    traffic_level = traffic_mapping.get(

        str(
            traffic_impact
        ).lower(),

        30

    )

    primary_image_url = valid_images[0].get("image_url", "") if valid_images else ""

    # Combine accepted and rejected image details for complete per-image records
    full_image_validation = []
    for item in validation_summary.get("accepted_details", []):
        full_image_validation.append({
            "image_index": item.get("image_index"),
            "filename": item.get("filename", ""),
            "status": "VALID",
            "valid": True,
            "relevant": True,
            "accepted": True,
            "reason": item.get("reason", "Accepted by disaster validation pipeline."),
            "predicted_label": item.get("predicted_label", ""),
            "predicted_disaster_type": item.get("predicted_disaster_type", ""),
            "confidence": item.get("confidence", 0.0),
            "image_url": item.get("image_url", ""),
            "groq_confidence": item.get("groq_confidence", 0.0),
            "groq_location_match": item.get("groq_location_match", False),
            "groq_reason": item.get("groq_reason", ""),
        })

    for item in (validation_summary.get("rejected_details", []) + upload_validation):
        full_image_validation.append({
            "image_index": item.get("image_index"),
            "filename": item.get("filename", ""),
            "status": "INVALID",
            "valid": False,
            "relevant": False,
            "accepted": False,
            "reason": item.get("reason", "Rejected by disaster validation pipeline."),
            "predicted_label": item.get("predicted_label", "none"),
            "predicted_disaster_type": item.get("predicted_disaster_type", "none"),
            "confidence": item.get("confidence", 0.0),
            "image_url": "",
            "groq_confidence": item.get("groq_confidence", 0.0),
            "groq_location_match": item.get("groq_location_match", False),
            "groq_reason": item.get("groq_reason", ""),
        })

    full_image_validation.sort(key=lambda x: x.get("image_index", 0))

    # ========================================================
    # EVENT
    # ========================================================

    event = {

        "event_id":
            event_id,

        "location":
            location,

        "description":
            description,

        "disaster_type":
            disaster_type,

        "disaster":
            disaster_type,

        "severity":
            severity,

        "confidence":
            confidence,

        "imageUrl":
            primary_image_url,

        "image_url":
            primary_image_url,

        "validationStatus":
            "VALIDATED" if len(valid_images) > 0 else "VALIDATION_FAILED",

        "validatedAt":
            datetime.now(timezone.utc).isoformat(),

        "observations":

            analysis.get(

                "observations",

                []

            ),

        "hazards":

            analysis.get(

                "hazards",

                []

            ),

        "infrastructure_damage":

            analysis.get(

                "infrastructure_damage",

                []

            ),

        "evacuation_required":

            analysis.get(

                "evacuation_required",

                False

            ),

        "victim_estimate":
            victim_estimate,

        "victims":
            victim_estimate or 0,

        "traffic_impact":
            traffic_impact,

        "traffic_level":
            traffic_level,

        "medical_access_impact":

            analysis.get(

                "medical_access_impact",

                "low"

            ),

        "summary":

            analysis.get(

                "summary",

                ""

            ),

        # ---------------------------------------------------
        # IMAGE INFORMATION
        # ---------------------------------------------------

        "total_images":
            len(images),

        "valid_images":
            len(valid_images),

        "rejected_images":
            len(rejected_images) + len(upload_validation),

        "image_validation":
            full_image_validation,

        "rejected_image_details":
            rejected_images + upload_validation,

        # ---------------------------------------------------
        # CLOUDINARY IMAGE METADATA
        # (public_id, secure_url, format, width, height, file_size per accepted image)
        # ---------------------------------------------------

        "cloudinary_images": [
            {
                **img["cloudinary_metadata"],
                "image_index": img["image_index"],
                "filename": img["filename"],
            }
            for img in valid_images
            if img.get("cloudinary_metadata")
        ],

        # ---------------------------------------------------
        # LOCATION
        # ---------------------------------------------------

        "latitude":
            latitude,

        "longitude":
            longitude,

        "status":
            "validated"

    }


    # ========================================================
    # DEBUG EVENT
    # ========================================================

    print("\n")
    print("=" * 70)

    print(
        "🧠 DYNAMIC EVENT CREATED"
    )

    print("=" * 70)

    print(

        json.dumps(

            event,

            indent=2,

            default=str

        )

    )


    # ========================================================
    # LANGGRAPH
    # ========================================================

    print("\n")
    print("=" * 70)

    print(
        "🤖 STARTING MULTI-AGENT ORCHESTRATION"
    )

    print("=" * 70)


    try:
        # Record initial incident creation event
        WorkflowService.record_event(
            incident_id=event_id,
            sender_agent_id="System",
            receiver_agent_id="CoordinatorAgent",
            event_type="incident_created",
            message=f"Disaster incident '{disaster_type}' reported and validated at {location}. Severity: {severity}/10.",
            status="success",
            action="create_incident",
            result="validated",
            metadata={
                "disaster_type": disaster_type,
                "location": location,
                "severity": severity,
                "victims": victim_estimate,
            }
        )

        WorkflowService.record_event(
            incident_id=event_id,
            sender_agent_id="CoordinatorAgent",
            receiver_agent_id="EmergencyAgent",
            event_type="agent_assigned",
            message=f"Coordinator assigned EmergencyAgent to perform hazard assessment and emergency response for {disaster_type}.",
            status="success",
            action="assign_agent",
        )

        initial_state = {

            "event":
                event,

            "responses":
                []

        }


        result = graph.invoke(
            initial_state
        )


    except Exception as e:

        print(
            "\n❌ LANGGRAPH EXECUTION FAILED"
        )

        print(
            "Error:",
            e
        )

        # --------------------------------------------------------
        # CLOUDINARY ROLLBACK
        # Clean up any uploaded assets so they don't become orphaned
        # --------------------------------------------------------
        for pub_id in _cloudinary_uploaded_public_ids:
            try:
                delete_image_from_cloudinary(pub_id)
            except Exception as del_err:
                print(f"⚠️ Cloudinary rollback delete failed for {pub_id}: {del_err}")

        raise HTTPException(

            status_code=500,

            detail=
                "Multi-agent disaster analysis failed."

        )


    # ========================================================
    # AGENT RESPONSES
    # ========================================================

    agent_responses = result.get(

        "responses",

        []

    )


    print(
        "\n🤖 AGENT RESPONSES:"
    )


    for response in agent_responses:

        print(
            response
        )


    # ========================================================
    # EXTRACT TRAFFIC ROUTE
    # ========================================================

    route_coordinates = []

    best_route = []


    for response in agent_responses:

        if not isinstance(
            response,
            dict
        ):

            continue


        traffic_response = response.get(
            "TrafficAgent"
        )


        if not traffic_response:

            continue


        traffic_response = (

            traffic_response.get(

                "traffic_response",

                {}

            )

        )


        route_coordinates = (

            traffic_response.get(

                "route_coordinates",

                []

            )

        )


        best_route = (

            traffic_response.get(

                "best_route",

                []

            )

        )


        break


    print(
        "\n🛣️ ROUTE COORDINATES:"
    )

    print(
        route_coordinates
    )


    # ========================================================
    # DASHBOARD PAYLOAD
    # ========================================================

    dashboard_payload = {

        "type":
            "disaster_analysis",

        "event":
            event,

        "analysis":
            analysis,

        "responses":
            agent_responses,

        "route_coordinates":
            route_coordinates,

        "best_route":
            best_route,

        "image_processing": {

            "total_images":
                len(images),

            "accepted_images":
                len(valid_images),

            "rejected_images":
                len(rejected_images),

            "rejected_details":
                rejected_images

        },

        "location": {

            "name":
                location,

            "latitude":
                latitude,

            "longitude":
                longitude

        },

        "status":
            "completed"

    }


    # ========================================================
    # BROADCAST
    # ========================================================

    print(
        "\n📡 Broadcasting disaster data..."
    )


    await broadcast_disaster_data(
        dashboard_payload
    )


    # ========================================================
    # COMPLETE
    # ========================================================

    print("\n")
    print("=" * 70)

    print(
        "✅ DISASTER ANALYSIS COMPLETE"
    )

    print(
        f"🆔 Event ID: {event_id}"
    )

    print(
        f"📷 Uploaded Images: "
        f"{len(images)}"
    )

    print(
        f"✅ Valid Images: "
        f"{len(valid_images)}"
    )

    print(
        f"❌ Rejected Images: "
        f"{len(rejected_images)}"
    )

    print(
        f"🚨 Disaster: {disaster_type}"
    )

    print(
        f"⚠️ Severity: {severity}/10"
    )

    print(
        f"🎯 Confidence: {confidence}"
    )

    print(
        f"📍 Location: {location}"
    )

    print(
        f"🌍 Coordinates: "
        f"{latitude}, {longitude}"
    )

    print("=" * 70)


    # ========================================================
    # API RESPONSE
    # ========================================================

    return {

        "success":
            True,

        "event":
            event,

        "analysis":
            analysis,

        "responses":
            agent_responses,

        "route_coordinates":
            route_coordinates,

        "best_route":
            best_route,

        "image_processing": {

            "total_images":
                len(images),

            "accepted_images":
                len(valid_images),

            "rejected_images":
                len(rejected_images),

            "upload_validation":
                upload_validation,

            "rejected_details":
                rejected_images

        },

        "location": {

            "name":
                location,

            "latitude":
                latitude,

            "longitude":
                longitude

        },

        "status":
            "completed"

    }

