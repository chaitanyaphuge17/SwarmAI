import os
import io
import json
import re
import base64
import asyncio

from dotenv import load_dotenv
from groq import Groq


# ============================================================
# LOAD ENVIRONMENT
# ============================================================

load_dotenv()


# ============================================================
# GROQ CONFIGURATION
# ============================================================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is missing.")


MODEL_NAME = os.getenv(
    "GROQ_MODEL",
    "qwen/qwen3.6-27b"
)


# ============================================================
# GROQ CLIENT
# ============================================================

client = Groq(
    api_key=GROQ_API_KEY
)


# ============================================================
# DEFAULT ANALYSIS
# ============================================================

def get_default_analysis():

    return {
        "disaster_relevant": False,
        "disaster_type": "Unknown Disaster",
        "severity": 0,
        "confidence": 0.0,
        "observations": [],
        "hazards": [],
        "infrastructure_damage": [],
        "evacuation_required": False,
        "victim_estimate": 0,
        "traffic_impact": "low",
        "medical_access_impact": "low",
        "summary": "",
        "image_validation": []
    }


# ============================================================
# REMOVE THINKING / EXTRA TEXT
# ============================================================

def remove_thinking(text: str):

    if not text:
        return ""

    text = re.sub(
        r"<think>.*?</think>",
        "",
        text,
        flags=re.DOTALL | re.IGNORECASE
    )

    text = re.sub(
        r"<analysis>.*?</analysis>",
        "",
        text,
        flags=re.DOTALL | re.IGNORECASE
    )

    return text.strip()


# ============================================================
# EXTRACT BALANCED JSON
# ============================================================

def extract_balanced_json(text: str):

    if not text:
        return None

    objects = []

    for start in range(len(text)):

        if text[start] != "{":
            continue

        depth = 0
        in_string = False
        escape = False

        for index in range(start, len(text)):

            char = text[index]

            if in_string:

                if escape:
                    escape = False
                    continue

                if char == "\\":
                    escape = True
                    continue

                if char == '"':
                    in_string = False

                continue

            if char == '"':
                in_string = True
                continue

            if char == "{":
                depth += 1

            elif char == "}":

                depth -= 1

                if depth == 0:

                    candidate = text[start:index + 1]

                    try:

                        parsed = json.loads(candidate)

                        if isinstance(parsed, dict):

                            objects.append(parsed)

                    except Exception:
                        pass

                    break

    if not objects:
        return None

    # Prefer disaster response object
    for obj in reversed(objects):

        if (
            "disaster_type" in obj
            or "disaster_relevant" in obj
            or "severity" in obj
        ):
            return obj

    return objects[-1]


# ============================================================
# EXTRACT JSON
# ============================================================

def extract_json_from_response(response_text: str):

    if not response_text:
        raise ValueError(
            "AI returned empty response."
        )

    cleaned = remove_thinking(
        response_text
    )

    print("\n")
    print("=" * 70)
    print("🔍 EXTRACTING JSON")
    print("=" * 70)

    # --------------------------------------------------------
    # DIRECT JSON
    # --------------------------------------------------------

    try:

        parsed = json.loads(cleaned)

        if isinstance(parsed, dict):

            print(
                "✅ Direct JSON parsed"
            )

            return parsed

    except Exception:
        pass

    # --------------------------------------------------------
    # REMOVE MARKDOWN FENCES
    # --------------------------------------------------------

    cleaned = re.sub(
        r"```json",
        "",
        cleaned,
        flags=re.IGNORECASE
    )

    cleaned = cleaned.replace(
        "```",
        ""
    ).strip()

    try:

        parsed = json.loads(cleaned)

        if isinstance(parsed, dict):

            print(
                "✅ JSON parsed after markdown cleanup"
            )

            return parsed

    except Exception:
        pass

    # --------------------------------------------------------
    # BALANCED JSON
    # --------------------------------------------------------

    parsed = extract_balanced_json(
        cleaned
    )

    if parsed:

        print(
            "✅ Balanced JSON extracted"
        )

        return parsed

    print("\n❌ JSON EXTRACTION FAILED")
    print("\nRAW RESPONSE:")
    print(response_text)

    raise ValueError(
        "AI returned invalid JSON."
    )


# ============================================================
# SAFE LIST
# ============================================================

def ensure_list(value):

    if value is None:
        return []

    if isinstance(value, list):
        return value

    if isinstance(value, str):
        return [value]

    return []


# ============================================================
# NORMALIZE BOOLEAN
# ============================================================

def normalize_boolean(
    value,
    default=False
):

    if isinstance(value, bool):
        return value

    if isinstance(value, str):

        value = value.lower().strip()

        if value in [
            "true",
            "yes",
            "1"
        ]:
            return True

        if value in [
            "false",
            "no",
            "0"
        ]:
            return False

    return default


# ============================================================
# NORMALIZE INTEGER
# ============================================================

def normalize_int(
    value,
    default=0
):

    try:
        return int(float(value))

    except Exception:
        return default


# ============================================================
# NORMALIZE FLOAT
# ============================================================

def normalize_float(
    value,
    default=0.0
):

    try:
        return float(value)

    except Exception:
        return default


# ============================================================
# NORMALIZE ANALYSIS
# ============================================================

def normalize_analysis(
    analysis,
    image_count
):

    default = get_default_analysis()

    if not isinstance(
        analysis,
        dict
    ):
        raise ValueError(
            "AI response is not a JSON object."
        )

    disaster_relevant = normalize_boolean(
        analysis.get(
            "disaster_relevant"
        ),
        False
    )

    disaster_type = str(
        analysis.get(
            "disaster_type",
            default["disaster_type"]
        )
    )

    severity = normalize_int(
        analysis.get(
            "severity"
        ),
        0
    )

    severity = max(
        0,
        min(severity, 10)
    )

    confidence = normalize_float(
        analysis.get(
            "confidence"
        ),
        0.5
    )

    confidence = max(
        0.0,
        min(confidence, 1.0)
    )

    victim_estimate = normalize_int(
        analysis.get(
            "victim_estimate"
        ),
        0
    )

    victim_estimate = max(
        0,
        victim_estimate
    )

    traffic_impact = str(
        analysis.get(
            "traffic_impact",
            "low"
        )
    ).lower()

    if traffic_impact not in [
        "low",
        "medium",
        "high"
    ]:
        traffic_impact = "low"

    medical_access_impact = str(
        analysis.get(
            "medical_access_impact",
            "low"
        )
    ).lower()

    if medical_access_impact not in [
        "low",
        "medium",
        "high"
    ]:
        medical_access_impact = "low"

    image_validation = ensure_list(
        analysis.get(
            "image_validation"
        )
    )

    # --------------------------------------------------------
    # ALWAYS CREATE IMAGE VALIDATION
    # --------------------------------------------------------

    normalized_validation = []

    for index in range(
        1,
        image_count + 1
    ):

        matching = None

        for item in image_validation:

            if not isinstance(item, dict):
                continue

            if normalize_int(
                item.get("image_index"),
                0
            ) == index:

                matching = item
                break

        if matching:
            rel_val = matching.get("relevant") if "relevant" in matching else (matching.get("valid") if "valid" in matching else matching.get("accepted"))
            is_rel = normalize_boolean(rel_val, False)

            normalized_validation.append({
                "image_index": index,
                "relevant": is_rel,
                "reason": str(
                    matching.get(
                        "reason",
                        "Validated during disaster analysis." if is_rel else "Validation failed."
                    )
                )
            })

        else:
            normalized_validation.append({
                "image_index": index,
                "relevant": False,
                "reason": "Missing image validation response."
            })

    return {

        "disaster_relevant":
            disaster_relevant,

        "disaster_type":
            disaster_type,

        "severity":
            severity,

        "confidence":
            confidence,

        "observations":
            ensure_list(
                analysis.get(
                    "observations"
                )
            ),

        "hazards":
            ensure_list(
                analysis.get(
                    "hazards"
                )
            ),

        "infrastructure_damage":
            ensure_list(
                analysis.get(
                    "infrastructure_damage"
                )
            ),

        "evacuation_required":
            normalize_boolean(
                analysis.get(
                    "evacuation_required"
                ),
                False
            ),

        "victim_estimate":
            victim_estimate,

        "traffic_impact":
            traffic_impact,

        "medical_access_impact":
            medical_access_impact,

        "summary":
            str(
                analysis.get(
                    "summary",
                    ""
                )
            ),

        "image_validation":
            normalized_validation
    }


# ============================================================
# COMPRESS IMAGE
# ============================================================

def compress_image(
    image_bytes: bytes,
    max_size=(640, 640),
    quality=60
):

    try:

        from PIL import Image

        image = Image.open(
            io.BytesIO(
                image_bytes
            )
        )

        image.thumbnail(
            max_size
        )

        if image.mode not in (
            "RGB",
            "L"
        ):
            image = image.convert(
                "RGB"
            )

        output = io.BytesIO()

        image.save(
            output,
            format="JPEG",
            quality=quality,
            optimize=True
        )

        compressed = output.getvalue()

        print(
            f"📦 Image compressed: "
            f"{len(image_bytes) / 1024:.1f} KB "
            f"-> "
            f"{len(compressed) / 1024:.1f} KB"
        )

        return compressed

    except Exception as error:

        print(
            "⚠️ Image compression failed:",
            error
        )

        return image_bytes


# ============================================================
# IMAGE TO BASE64
# ============================================================

def image_to_base64(
    image_bytes: bytes
):

    encoded = base64.b64encode(
        image_bytes
    ).decode(
        "utf-8"
    )

    return (
        f"data:image/jpeg;base64,{encoded}"
    )


# ============================================================
# BUILD IMAGE CONTENT
# ============================================================

def build_image_content(images):

    content = []

    # Important:
    # Limit Groq to maximum 2 images.
    # This prevents unnecessary token load.

    for image in images[:2]:

        image_bytes = image.get(
            "image_bytes"
        )

        if not image_bytes:
            continue

        compressed = compress_image(
            image_bytes
        )

        image_url = image_to_base64(
            compressed
        )

        content.append({

            "type":
                "image_url",

            "image_url": {

                "url":
                    image_url
            }
        })

    return content


# ============================================================
# SMALL OPTIMIZED PROMPT
# ============================================================

def build_analysis_prompt(
    location: str,
    description: str,
    image_count: int
):

    return f"""
Analyze the accepted disaster images.

Location: {location}
Description: {description or "None"}
Images: {image_count}

Cross-check visible evidence with the location and description.

Return one JSON object only.

Required keys:
disaster_relevant,
disaster_type,
severity,
confidence,
observations,
hazards,
infrastructure_damage,
evacuation_required,
victim_estimate,
traffic_impact,
medical_access_impact,
summary,
image_validation.

Rules:
- disaster_relevant is boolean.
- severity is integer 0-10.
- confidence is 0-1.
- traffic_impact is low, medium, or high.
- medical_access_impact is low, medium, or high.
- Do not invent visible damage or casualties.
- If description conflicts with images, trust visible evidence.
- If multiple accepted images show different disasters, identify the dominant event supported by the description and location.
- image_validation must contain {image_count} objects.

Return valid JSON only.
"""


# ============================================================
# SAFE FALLBACK
# ============================================================

def build_safe_fallback(
    images,
    description,
    location
):

    disaster_type = (
        "Reported Disaster"
        if description
        else "Unknown Disaster"
    )

    description_text = str(
        description or ""
    ).lower()

    location_text = str(
        location or ""
    ).lower()

    explicit_fire = any(
        keyword in description_text
        for keyword in [
            "fire",
            "wildfire",
            "forest fire"
        ]
    )

    coastal_location = any(
        keyword in location_text
        for keyword in [
            "marine drive",
            "sea face",
            "seaface",
            "beach",
            "coast"
        ]
    )

    image_validation = []

    for index, image in enumerate(images, start=1):
        validation = image.get("validation", {})
        predicted_label = str(
            validation.get("predicted_label", "")
        ).lower()

        is_forest_fire = "fire" in predicted_label

        rel_val = image.get("accepted") if "accepted" in image else (
            validation.get("accepted") if "accepted" in validation else (
                validation.get("relevant") if "relevant" in validation else validation.get("valid")
            )
        )
        is_accepted = normalize_boolean(rel_val, True if (validation or image) else False)

        relevant = is_accepted and not (
            coastal_location
            and is_forest_fire
            and not explicit_fire
        )

        image_validation.append({
            "image_index": image.get(
                "image_index",
                index
            ),
            "relevant": relevant,
            "reason": (
                "Fire image does not match the coastal high-tide incident."
                if (is_accepted and not relevant)
                else (
                    validation.get("reason") or image.get("reason", "Accepted by disaster image validation.")
                    if relevant
                    else "Image failed disaster validation."
                )
            ),
            "predicted_label": predicted_label
        })

    relevant_images = [
        item for item in image_validation
        if item["relevant"]
    ]

    return {

        "disaster_relevant":
            bool(relevant_images),

        "disaster_type":
            disaster_type,

        "severity":
            5,

        "confidence":
            0.45,

        "observations": [
            "Automated image validation identified disaster-related visual content."
        ],

        "hazards": [],

        "infrastructure_damage": [],

        "evacuation_required":
            False,

        "victim_estimate":
            0,

        "traffic_impact":
            "medium",

        "medical_access_impact":
            "medium",

        "summary":
            description or
            "Disaster event detected. AI vision analysis was unavailable.",

        "image_validation": image_validation
    }


def enforce_image_consistency(
    analysis,
    images,
    location,
    description
):

    location_text = str(
        location or ""
    ).lower()

    description_text = str(
        description or ""
    ).lower()

    coastal_location = any(
        keyword in location_text
        for keyword in [
            "marine drive",
            "sea face",
            "seaface",
            "beach",
            "coast"
        ]
    )

    explicit_fire = any(
        keyword in description_text
        for keyword in [
            "fire",
            "wildfire",
            "forest fire"
        ]
    )

    if not coastal_location or explicit_fire:
        return analysis

    validation_by_index = {
        image.get("image_index"): image.get(
            "validation",
            {}
        )
        for image in images
    }

    rejected_indices = set()

    for item in analysis.get("image_validation", []):
        image_index = item.get("image_index")
        validation = validation_by_index.get(
            image_index,
            {}
        )
        predicted_label = str(
            validation.get("predicted_label", "")
        ).lower()

        if "fire" in predicted_label:
            item["relevant"] = False
            item["reason"] = (
                "Fire image does not match the coastal high-tide incident."
            )
            rejected_indices.add(image_index)

    if rejected_indices:
        remaining = [
            item for item in analysis["image_validation"]
            if item.get("relevant")
        ]
        analysis["disaster_relevant"] = bool(remaining)

    return analysis


# ============================================================
# GROQ REQUEST
# ============================================================

def call_groq(
    message_content
):

    return client.chat.completions.create(

        model=MODEL_NAME,

        messages=[

            {

                "role":
                    "user",

                "content":
                    message_content
            }
        ],

        temperature=0,

        max_completion_tokens=512,

        reasoning_effort="none"

        # IMPORTANT:
        # No json_schema here.
        # qwen/qwen3.6 can fail with
        # json_validate_failed.
    )


# ============================================================
# ANALYZE DISASTER IMAGE
# ============================================================

async def analyze_disaster_image(

    images: list,

    location: str,

    description: str = ""

):

    print("\n")
    print("=" * 70)
    print("🧠 STARTING OPTIMIZED DISASTER ANALYSIS")
    print("=" * 70)

    print(
        f"📷 Images received: {len(images)}"
    )

    print(
        f"📍 Location: {location}"
    )

    if not images:

        raise ValueError(
            "No images were provided."
        )

    # ========================================================
    # PROMPT
    # ========================================================

    prompt = build_analysis_prompt(

        location=location,

        description=description,

        image_count=len(images)
    )

    # ========================================================
    # IMAGE CONTENT
    # ========================================================

    image_content = build_image_content(
        images
    )

    if not image_content:

        raise ValueError(
            "No valid image content available."
        )

    message_content = [

        {

            "type":
                "text",

            "text":
                prompt
        }

    ] + image_content

    # ========================================================
    # GROQ ATTEMPTS
    # ========================================================

    last_error = None

    for attempt in range(1, 2):

        print("\n")
        print("=" * 70)

        print(
            f"🤖 AI ANALYSIS ATTEMPT "
            f"{attempt}/1"
        )

        print("=" * 70)

        print(
            f"⚡ Using model: "
            f"{MODEL_NAME}"
        )

        try:

            completion = await asyncio.to_thread(

                call_groq,

                message_content
            )

            response_text = (
                completion
                .choices[0]
                .message
                .content
            )

            print(
                "\n🤖 RAW RESPONSE:"
            )

            print(
                response_text
            )

            parsed = extract_json_from_response(
                response_text
            )

            analysis = normalize_analysis(

                parsed,

                len(images)
            )

            analysis = enforce_image_consistency(
                analysis,
                images,
                location,
                description
            )

            print("\n")
            print("=" * 70)
            print("✅ DISASTER ANALYSIS SUCCESSFUL")
            print("=" * 70)

            print(
                json.dumps(
                    analysis,
                    indent=2
                )
            )

            return analysis

        except Exception as error:

            last_error = error

            print(
                "\n⚠️ ANALYSIS ATTEMPT FAILED:"
            )

            print(
                f"{type(error).__name__}: "
                f"{repr(error)}"
            )

            if getattr(error, "status_code", None) == 429:

                print(
                    "⚠️ Groq daily token quota reached."
                )

                break

            if attempt < 2:

                await asyncio.sleep(1)

    # ========================================================
    # SAFE FALLBACK
    # ========================================================

    print("\n")
    print("=" * 70)
    print("❌ GROQ ANALYSIS UNAVAILABLE")
    print("=" * 70)

    print(
        f"Last error: {last_error}"
    )

    print(
        "⚠️ Using safe fallback disaster analysis."
    )

    fallback = build_safe_fallback(
        images,
        description,
        location
    )

    return normalize_analysis(
        fallback,
        len(images)
    )