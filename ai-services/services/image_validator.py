"""
Local Image Validation Engine for SwarmAI Disaster Management System.
Uses local pretrained PyTorch / HuggingFace model (google/siglip-base-patch16-224 or VISION_MODEL_NAME).
No Groq calls for basic image classification.
Validates disaster images, geographic plausibility against location, and description consistency.
"""

import io
import os
import re
import threading
import asyncio
from typing import List, Dict, Any, Tuple, Optional
from PIL import Image

import torch
from transformers import AutoProcessor, AutoModel

# ============================================================
# CONFIGURATION
# ============================================================

VISION_MODEL_NAME = os.getenv("VISION_MODEL_NAME", "google/siglip-base-patch16-224")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CONFIDENCE_MARGIN = float(os.getenv("VISION_CONFIDENCE_MARGIN", "0.00"))
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

ALLOWED_IMAGE_FORMATS = {"JPEG", "JPG", "PNG", "WEBP"}

# ============================================================
# MODEL CACHE & THREAD SAFETY
# ============================================================

_model = None
_processor = None
_model_lock = threading.Lock()
_model_load_error = None


# ============================================================
# SAFE PRINT HELPER
# ============================================================

import sys

def safe_print(*args, **kwargs):
    """Safe print helper that falls back gracefully when console stdout cannot encode emojis."""
    try:
        print(*args, **kwargs)
    except Exception:
        encoding = getattr(sys.stdout, 'encoding', None) or 'utf-8'
        safe_args = [
            str(arg).encode(encoding, errors="replace").decode(encoding)
            for arg in args
        ]
        try:
            print(*safe_args, **kwargs)
        except Exception:
            pass


def get_model():
    """
    Lazy loads and caches the vision model and processor.
    Caches loading errors to prevent repeated download attempts.
    """
    global _model, _processor, _model_load_error

    if _model_load_error is not None:
        raise RuntimeError(
            f"Local vision model ({VISION_MODEL_NAME}) failed to load previously: {_model_load_error}"
        )

    if _model is not None and _processor is not None:
        return _model, _processor

    with _model_lock:
        if _model_load_error is not None:
            raise RuntimeError(
                f"Local vision model ({VISION_MODEL_NAME}) failed to load previously: {_model_load_error}"
            )

        if _model is None or _processor is None:
            safe_print("\n" + "=" * 70)
            safe_print("🧠 LOADING LOCAL VISION MODEL FOR DISASTER VALIDATION")
            safe_print(f"📦 Model: {VISION_MODEL_NAME}")
            safe_print(f"💻 Device: {DEVICE}")
            safe_print("=" * 70)

            try:
                processor = AutoProcessor.from_pretrained(VISION_MODEL_NAME)
                model = AutoModel.from_pretrained(VISION_MODEL_NAME)
                model.to(DEVICE)
                model.eval()

                _processor = processor
                _model = model
                safe_print("✅ LOCAL VISION MODEL LOADED SUCCESSFULLY")
            except Exception as error:
                _model_load_error = error
                safe_print(f"❌ FAILED TO LOAD VISION MODEL: {error}")
                raise RuntimeError(
                    f"Local vision model ({VISION_MODEL_NAME}) is unavailable: {error}"
                ) from error

    return _model, _processor



# ============================================================
# DISASTER LABELS & CANONICAL MAPPINGS
# ============================================================

DISASTER_LABELS = [
    "flooded urban road",
    "river flood",
    "coastal flood",
    "high tide flooding",
    "storm surge",
    "tsunami",
    "large waves flooding a coastal road",
    "forest wildfire",
    "urban building fire",
    "smoke from a fire",
    "earthquake damage",
    "collapsed building",
    "landslide",
    "blocked road",
    "vehicle accident",
    "damaged infrastructure",
    "emergency rescue operation",
]

NON_DISASTER_LABELS = [
    "normal photograph",
    "selfie or portrait",
    "document or screenshot",
    "unrelated object",
    "ordinary landscape",
]

LABEL_CANONICAL_MAP = {
    # Coastal flood / ocean events
    "coastal flood": "coastal_flood",
    "high tide flooding": "coastal_flood",
    "storm surge": "coastal_flood",
    "tsunami": "coastal_flood",
    "large waves flooding a coastal road": "coastal_flood",

    # Wildfire
    "forest wildfire": "wildfire",

    # Urban fire
    "urban building fire": "urban_fire",
    "smoke from a fire": "urban_fire",

    # Flood
    "flooded urban road": "flood",
    "river flood": "flood",

    # Earthquake
    "earthquake damage": "earthquake",

    # Collapse
    "collapsed building": "collapse",

    # Landslide
    "landslide": "landslide",

    # Accident / infrastructure
    "blocked road": "accident",
    "vehicle accident": "accident",
    "damaged infrastructure": "collapse",
    "emergency rescue operation": "accident",

    # Non-disaster
    "normal photograph": "non_disaster",
    "selfie or portrait": "non_disaster",
    "document or screenshot": "non_disaster",
    "unrelated object": "non_disaster",
    "ordinary landscape": "non_disaster",
}


# ============================================================
# BYTE-LEVEL IMAGE INTEGRITY VALIDATION
# ============================================================

def validate_image_bytes(image_bytes: bytes, filename: str = "image.jpg") -> Dict[str, Any]:
    """
    Validates raw image bytes using Pillow.
    Ensures non-empty, max 10MB, allowed formats (JPEG, PNG, WEBP), and non-corrupted.
    """
    if not image_bytes or len(image_bytes) == 0:
        return {
            "valid": False,
            "reason": "Image file is empty.",
            "pil_image": None,
        }

    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        return {
            "valid": False,
            "reason": f"Image size ({len(image_bytes)} bytes) exceeds the 10 MB limit.",
            "pil_image": None,
        }

    try:
        bio = io.BytesIO(image_bytes)
        img = Image.open(bio)
        img_format = (img.format or "").upper()

        if img_format not in {"JPEG", "JPG", "PNG", "WEBP", "MPO"}:
            return {
                "valid": False,
                "reason": f"Unsupported image format '{img_format}'. Accept JPEG, PNG, WEBP only.",
                "pil_image": None,
            }

        # Verify full image file integrity
        img.verify()

        # Re-open for actual processing as RGB
        bio.seek(0)
        img_rgb = Image.open(bio).convert("RGB")

        return {
            "valid": True,
            "reason": "Passed byte integrity validation.",
            "pil_image": img_rgb,
        }

    except Exception as error:
        return {
            "valid": False,
            "reason": f"Corrupted or unreadable image file: {str(error)}",
            "pil_image": None,
        }


# ============================================================
# GEOGRAPHIC LOCATION PLAUSIBILITY EVALUATOR
# ============================================================

COASTAL_KEYWORDS = {
    "marine drive", "mumbai", "coastal", "beach", "marina", "goa", "chennai",
    "visakhapatnam", "vizag", "kochi", "kerala coast", "seashore", "sea",
    "ocean", "island", "harbor", "harbour", "pier", "bay", "port", "miami",
    "hawaii", "maldives", "sydney", "san francisco", "coast"
}

INLAND_KEYWORDS = {
    "punjab", "chandigarh", "delhi", "new delhi", "haryana", "uttar pradesh", "up",
    "jaipur", "rajasthan", "lucknow", "kanpur", "bhopal", "indore", "patna",
    "nagpur", "bihar", "patna", "jharkhand", "ranchi", "chhattisgarh", "raipur",
    "ludhiana", "amritsar", "jalandhar", "kharar", "gharuan", "sahibzada ajit singh nagar",
    "mohali", "baddi", "shimla", "solan", "gwalior", "kansas"
}


def evaluate_geographic_plausibility(location: str, predicted_disaster_type: str) -> Tuple[str, str]:
    """
    Evaluates whether predicted_disaster_type is geographically possible at location.
    Returns (status, reason) where status is one of:
      - 'geographically_plausible'
      - 'geographically_implausible'
      - 'location_unverified'
    """
    if not location or not location.strip():
        return "location_unverified", "No location provided for geographic validation."

    loc_clean = location.lower().strip()

    is_known_inland = any(kw in loc_clean for kw in INLAND_KEYWORDS)
    is_known_coastal = any(kw in loc_clean for kw in COASTAL_KEYWORDS)

    # Rule 1: Coastal floods (high tide, storm surge, tsunami, ocean flood) require coastal location
    if predicted_disaster_type == "coastal_flood":
        if is_known_inland and not is_known_coastal:
            return (
                "geographically_implausible",
                f"Coastal flood / high tide / tsunami disaster is geographically implausible at inland location '{location}'."
            )
        elif is_known_coastal:
            return (
                "geographically_plausible",
                f"Coastal disaster is geographically plausible at coastal location '{location}'."
            )
        else:
            return (
                "location_unverified",
                f"Location '{location}' could not be definitively verified as coastal for coastal flood check."
            )

    # Rule 2: Urban floods and river floods are valid inland and coastal
    if predicted_disaster_type == "flood":
        return "geographically_plausible", f"Urban/river flooding is geographically plausible at '{location}'."

    # Rule 3: Earthquakes can happen anywhere (inland or coastal)
    if predicted_disaster_type == "earthquake":
        return "geographically_plausible", f"Earthquakes are geographically plausible at '{location}'."

    # Rule 4: Wildfires and urban building fires are possible in most locations
    if predicted_disaster_type in {"wildfire", "urban_fire"}:
        return "geographically_plausible", f"Fires are geographically plausible at '{location}'."

    # Rule 5: Landslide - accepted when plausible; if terrain unverified, fallback to location_unverified
    if predicted_disaster_type == "landslide":
        return "geographically_plausible", f"Landslide is geographically plausible at '{location}'."

    # Rule 6: Building collapse, accidents, structural damage are plausible anywhere
    if predicted_disaster_type in {"collapse", "accident"}:
        return "geographically_plausible", f"{predicted_disaster_type.capitalize()} is geographically plausible at '{location}'."

    return "location_unverified", f"Geographic status unverified for location '{location}'."


# ============================================================
# DESCRIPTION CONSISTENCY EVALUATOR
# ============================================================

def evaluate_description_consistency(user_description: str, predicted_disaster_type: str) -> Tuple[bool, Optional[str]]:
    """
    Compares user prompt description with model output.
    Returns (match_boolean, mismatch_reason).
    """
    if not user_description or not user_description.strip():
        return True, None

    desc_clean = user_description.lower().strip()

    claims_flood_or_tide = any(w in desc_clean for w in ["flood", "high tide", "tide", "tsunami", "waterlogging", "water wave"])
    claims_fire = any(w in desc_clean for w in ["fire", "wildfire", "flames", "burning", "smoke", "blaze"])

    if claims_flood_or_tide and not claims_fire and predicted_disaster_type in {"urban_fire", "wildfire"}:
        return False, "Description claims flood/high tide but image evidence shows a fire disaster."

    if claims_fire and not claims_flood_or_tide and predicted_disaster_type in {"coastal_flood", "flood"}:
        return False, "Description claims fire but image evidence shows a flood disaster."

    return True, None


# ============================================================
# LOCAL MODEL CLASSIFIER (Comparative Scoring)
# ============================================================

def classify_image_locally(pil_image: Image.Image) -> Dict[str, Any]:
    """
    Classifies a PIL RGB image using local SigLIP model.
    Uses comparative scoring (strongest disaster label vs strongest non-disaster label)
    to eliminate label-count bias.
    """
    model, processor = get_model()

    labels = DISASTER_LABELS + NON_DISASTER_LABELS

    inputs = processor(
        text=labels,
        images=pil_image,
        return_tensors="pt",
        padding="max_length",
    )

    inputs = {k: v.to(DEVICE) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)

    logits = outputs.logits_per_image[0]
    probs = torch.softmax(logits, dim=-1).cpu().tolist()

    disaster_probs = probs[:len(DISASTER_LABELS)]
    non_disaster_probs = probs[len(DISASTER_LABELS):]

    best_disaster_idx = max(range(len(disaster_probs)), key=lambda i: disaster_probs[i])
    strongest_disaster_score = float(disaster_probs[best_disaster_idx])
    best_disaster_raw_label = DISASTER_LABELS[best_disaster_idx]

    best_non_disaster_idx = max(range(len(non_disaster_probs)), key=lambda i: non_disaster_probs[i])
    strongest_non_disaster_score = float(non_disaster_probs[best_non_disaster_idx])
    best_non_disaster_raw_label = NON_DISASTER_LABELS[best_non_disaster_idx]

    is_disaster = strongest_disaster_score > (strongest_non_disaster_score + CONFIDENCE_MARGIN)

    predicted_raw_label = best_disaster_raw_label if is_disaster else best_non_disaster_raw_label
    predicted_canonical_type = LABEL_CANONICAL_MAP.get(predicted_raw_label, "non_disaster" if not is_disaster else "disaster")

    total_score = strongest_disaster_score + strongest_non_disaster_score
    confidence = (strongest_disaster_score / total_score) if total_score > 0 else 0.0

    return {
        "vision_relevant": bool(is_disaster),
        "predicted_label": predicted_raw_label,
        "predicted_disaster_type": predicted_canonical_type,
        "confidence": round(float(confidence), 2),
        "disaster_score": round(strongest_disaster_score, 4),
        "non_disaster_score": round(strongest_non_disaster_score, 4),
        "strongest_disaster_label": best_disaster_raw_label,
        "strongest_non_disaster_label": best_non_disaster_raw_label,
    }


# ============================================================
# INDEPENDENT SINGLE IMAGE PROCESSOR
# ============================================================

def process_single_image(
    image_data: Dict[str, Any],
    location: str = "",
    user_description: str = ""
) -> Dict[str, Any]:
    """
    Independently evaluates a single image against byte rules, vision model, location rules, and description rules.
    """
    image_index = image_data.get("image_index", 1)
    filename = image_data.get("filename", f"image_{image_index}")
    image_bytes = image_data.get("image_bytes")

    # Step 1: Byte validation
    byte_result = validate_image_bytes(image_bytes, filename=filename)
    file_valid = byte_result["valid"]

    if not file_valid:
        return {
            "image_index": image_index,
            "filename": filename,
            "accepted": False,
            "relevant": False,
            "predicted_disaster_type": "none",
            "predicted_label": "none",
            "confidence": 0.0,
            "disaster_score": 0.0,
            "non_disaster_score": 0.0,
            "file_valid": False,
            "vision_relevant": False,
            "description_match": False,
            "geographic_status": "location_unverified",
            "reason": byte_result["reason"]
        }

    pil_img = byte_result["pil_image"]

    # Step 2: Vision model classification
    try:
        cls_res = classify_image_locally(pil_img)
    except Exception as error:
        print(f"❌ Local classification error on image {image_index} ({filename}): {error}")
        return {
            "image_index": image_index,
            "filename": filename,
            "accepted": False,
            "relevant": False,
            "predicted_disaster_type": "unknown",
            "predicted_label": "unknown",
            "confidence": 0.0,
            "disaster_score": 0.0,
            "non_disaster_score": 0.0,
            "file_valid": True,
            "vision_relevant": False,
            "description_match": False,
            "geographic_status": "location_unverified",
            "reason": f"Model inference failed: {str(error)}"
        }

    vision_relevant = cls_res["vision_relevant"]
    pred_type = cls_res["predicted_disaster_type"]
    pred_label = cls_res["predicted_label"]

    # Step 3: Geographic plausibility evaluation
    geo_status, geo_reason = evaluate_geographic_plausibility(location, pred_type)

    # Step 4: Description consistency evaluation
    desc_match, desc_reason = evaluate_description_consistency(user_description, pred_type)

    # Step 5: Decision logic
    if not vision_relevant:
        accepted = False
        reason = f"Image shows non-disaster content ('{cls_res['strongest_non_disaster_label']}')."
    elif geo_status == "geographically_implausible":
        accepted = False
        reason = geo_reason
    elif not desc_match:
        accepted = False
        reason = desc_reason
    else:
        accepted = True
        reason = f"The image shows {pred_label}."

    return {
        "image_index": image_index,
        "filename": filename,
        "accepted": accepted,
        "relevant": vision_relevant,
        "predicted_disaster_type": pred_type,
        "predicted_label": pred_label,
        "confidence": cls_res["confidence"],
        "disaster_score": cls_res["disaster_score"],
        "non_disaster_score": cls_res["non_disaster_score"],
        "file_valid": True,
        "vision_relevant": vision_relevant,
        "description_match": desc_match,
        "geographic_status": geo_status,
        "reason": reason,
        "image_url": image_data.get("image_url", ""),
    }


# ============================================================
# MAIN BATCH IMAGE VALIDATOR
# ============================================================

async def validate_disaster_images(
    images: List[Dict[str, Any]],
    location: str = "",
    user_description: str = ""
) -> Dict[str, Any]:
    """
    Validates up to 2 uploaded images independently.
    Reconciles total counts: accepted_images + rejected_images == total_images.
    """
    safe_print("\n" + "=" * 70)
    safe_print("🔍 STARTING LOCAL IMAGE VALIDATION PIPELINE")
    safe_print(f"📍 Location: {location}")
    safe_print(f"📝 Description: {user_description}")
    safe_print(f"📷 Total Uploads: {len(images)}")
    safe_print("=" * 70)

    if not images:
        return {
            "total_images": 0,
            "accepted_images": 0,
            "rejected_images": 0,
            "accepted_details": [],
            "rejected_details": [],
            "dominant_disaster_type": "none",
            "overall_geographic_status": "location_unverified",
            "overall_confidence": 0.0
        }

    images_to_process = images
    total_count = len(images_to_process)

    accepted_details = []
    rejected_details = []

    for idx, img_item in enumerate(images_to_process, start=1):
        if "image_index" not in img_item:
            img_item["image_index"] = idx

        res = await asyncio.to_thread(
            process_single_image,
            image_data=img_item,
            location=location,
            user_description=user_description
        )

        if res["accepted"]:
            accepted_details.append(res)
            safe_print(f"✅ Image {res['image_index']} ({res['filename']}) ACCEPTED: {res['reason']}")
        else:
            rejected_details.append(res)
            safe_print(f"❌ Image {res['image_index']} ({res['filename']}) REJECTED: {res['reason']}")

    if accepted_details:
        best_accepted = max(accepted_details, key=lambda item: item.get("disaster_score", 0.0))
        dominant_type = best_accepted["predicted_disaster_type"]
        overall_conf = max(item["confidence"] for item in accepted_details)
        overall_geo = best_accepted["geographic_status"]
    elif rejected_details:
        best_rejected = max(rejected_details, key=lambda item: item.get("disaster_score", 0.0))
        dominant_type = best_rejected["predicted_disaster_type"]
        overall_conf = max(item["confidence"] for item in rejected_details)
        overall_geo = best_rejected["geographic_status"]
    else:
        dominant_type = "none"
        overall_conf = 0.0
        overall_geo = "location_unverified"


    assert len(accepted_details) + len(rejected_details) == total_count, "Counts must reconcile exactly!"

    summary = {
        "total_images": total_count,
        "accepted_images": len(accepted_details),
        "rejected_images": len(rejected_details),
        "accepted_details": accepted_details,
        "rejected_details": rejected_details,
        "dominant_disaster_type": dominant_type,
        "overall_geographic_status": overall_geo,
        "overall_confidence": overall_conf
    }

    safe_print("=" * 70)
    safe_print(f"📊 SUMMARY: {summary['accepted_images']}/{total_count} Accepted")
    safe_print("=" * 70 + "\n")

    return summary