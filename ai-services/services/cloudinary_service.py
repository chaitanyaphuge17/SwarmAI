import os
import logging
import io
from datetime import datetime, timezone
import cloudinary
import cloudinary.uploader

logger = logging.getLogger("swarmai.cloudinary")

# ============================================================
# CLOUDINARY CONFIGURATION
# ============================================================

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    try:
        cloudinary.config(
            cloud_name=CLOUDINARY_CLOUD_NAME,
            api_key=CLOUDINARY_API_KEY,
            api_secret=CLOUDINARY_API_SECRET,
            secure=True
        )
        logger.info("🛡️ Cloudinary configured successfully.")
        print("🛡️ Cloudinary configured successfully.")
    except Exception as e:
        logger.error(f"❌ Cloudinary config failed: {e}")
        print(f"❌ Cloudinary config failed: {e}")
else:
    logger.warning("⚠️ Cloudinary credentials missing in env variables.")
    print("⚠️ Cloudinary credentials missing in env variables.")


# ============================================================
# UPLOAD TO CLOUDINARY
# ============================================================

def upload_image_to_cloudinary(image_bytes: bytes, filename: str) -> dict:
    """
    Uploads in-memory image bytes to Cloudinary.
    Returns the Cloudinary metadata dict on success.
    """
    if not (CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET):
        raise ValueError("Cloudinary credentials are not configured in environment variables.")

    file_like = io.BytesIO(image_bytes)
    
    # Generate unique public_id or use safe name
    display_name = os.path.splitext(filename)[0] if filename else "disaster_evidence"
    
    upload_result = cloudinary.uploader.upload(
        file_like,
        resource_type="image",
        folder="swarmai_disasters",
        public_id=display_name,
        unique_filename=True
    )
    
    return {
        "public_id": upload_result.get("public_id"),
        "secure_url": upload_result.get("secure_url"),
        "format": upload_result.get("format"),
        "width": upload_result.get("width"),
        "height": upload_result.get("height"),
        "file_size": upload_result.get("bytes"),
        "upload_timestamp": upload_result.get("created_at") or datetime.now(timezone.utc).isoformat()
    }


# ============================================================
# DELETE FROM CLOUDINARY
# ============================================================

def delete_image_from_cloudinary(public_id: str) -> bool:
    """
    Deletes an asset from Cloudinary by its public ID.
    Used for cleaning up in case of database transaction/orchestration failures.
    """
    if not public_id:
        return False
    try:
        result = cloudinary.uploader.destroy(public_id)
        status = result.get("result") == "ok"
        logger.info(f"🗑️ Cloudinary destroy result for {public_id}: {result.get('result')}")
        print(f"🗑️ Cloudinary destroy result for {public_id}: {result.get('result')}")
        return status
    except Exception as e:
        logger.error(f"❌ Failed to delete Cloudinary asset {public_id}: {e}")
        print(f"❌ Failed to delete Cloudinary asset {public_id}: {e}")
        return False


# ============================================================
# GENERATE OPTIMIZED THUMBNAIL URL
# ============================================================

def get_cloudinary_thumbnail(secure_url: str) -> str:
    """
    Constructs an optimized transformed thumbnail URL from a raw Cloudinary URL.
    Format: https://res.cloudinary.com/<cloud>/image/upload/<transformations>/v<version>/<public_id>
    If not a Cloudinary URL or invalid, returns as-is.
    """
    if not secure_url:
        return ""
    
    if not isinstance(secure_url, str):
        return secure_url
        
    if "res.cloudinary.com" not in secure_url or "/upload/" not in secure_url:
        return secure_url
        
    # Inject quality auto, fetch format auto, and thumbnail bounding limits
    return secure_url.replace("/upload/", "/upload/c_fill,w_450,h_300,g_auto,q_auto,f_auto/")
