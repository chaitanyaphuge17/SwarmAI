"""
SwarmAI — Twilio SMS Service

Isolated module responsible ONLY for sending SMS alerts via Twilio.

Responsibilities:
- Initialize the Twilio client from environment variables
- Accept a message string and a recipient phone number
- Send the SMS
- Return success/failure information
- Handle Twilio exceptions safely without crashing the caller

This module contains NO validation logic, NO incident creation logic,
NO AI logic, and NO dashboard logic.
"""

import os
import logging

logger = logging.getLogger("swarmai.twilio")


def send_sms_alert(message: str, to_number: str = None) -> dict:
    """
    Send an SMS alert via Twilio.

    Args:
        message:   The SMS body text to send.
        to_number: Recipient phone number (E.164 format, e.g. '+919876543210').
                   Falls back to ADMIN_PHONE_NUMBER env var if not provided.
                   ADMIN_PHONE_NUMBER may be a comma-separated list of numbers;
                   an SMS is sent to each one individually.

    Returns:
        dict with keys:
            success (bool)       - True if at least one SMS was dispatched
            results (list[dict]) - Per-recipient outcome (sid or error)
            error   (str)        - Set only when ALL recipients failed
    """

    # ------------------------------------------------------------------
    # 1. Read credentials from environment -- never hard-coded
    # ------------------------------------------------------------------
    account_sid  = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    auth_token   = os.getenv("TWILIO_AUTH_TOKEN",  "").strip()
    from_number  = os.getenv("TWILIO_PHONE_NUMBER", "").strip()
    admin_number = os.getenv("ADMIN_PHONE_NUMBER",  "").strip()

    raw_recipient = (to_number or admin_number).strip()

    # Support comma-separated list of numbers in ADMIN_PHONE_NUMBER
    recipients = [n.strip() for n in raw_recipient.split(",") if n.strip()]

    # ------------------------------------------------------------------
    # 2. Validate configuration before attempting to send
    # ------------------------------------------------------------------
    if not account_sid or not auth_token:
        logger.warning("Twilio notification skipped: TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not configured.")
        return {"success": False, "error": "Twilio credentials not configured."}

    if not from_number:
        logger.warning("Twilio notification skipped: TWILIO_PHONE_NUMBER not configured.")
        return {"success": False, "error": "Twilio sender phone number not configured."}

    if not recipients:
        logger.warning("Twilio notification skipped: No recipient phone number (ADMIN_PHONE_NUMBER not configured).")
        return {"success": False, "error": "Recipient phone number not configured."}

    # ------------------------------------------------------------------
    # 3. Send to each recipient -- catch exceptions per number
    # ------------------------------------------------------------------
    try:
        from twilio.rest import Client
        client = Client(account_sid, auth_token)
    except Exception as exc:
        logger.error(f"Twilio client init failed: {exc}")
        return {"success": False, "error": str(exc)}

    results = []
    any_success = False

    for number in recipients:
        try:
            twilio_message = client.messages.create(
                body=message,
                from_=from_number,
                to=number,
            )
            logger.info(f"Twilio SMS sent | SID: {twilio_message.sid} | To: {number}")
            results.append({"to": number, "success": True, "sid": twilio_message.sid})
            any_success = True
        except Exception as exc:
            safe_error = str(exc)
            logger.error(f"Twilio notification failed for {number}: {safe_error}")
            results.append({"to": number, "success": False, "error": safe_error})

    if any_success:
        return {"success": True, "results": results}
    else:
        return {"success": False, "results": results, "error": "All recipients failed."}


def build_incident_sms(
    incident_id: str,
    disaster_type: str,
    severity,
    location: str,
    summary: str = "",
) -> str:
    """
    Build a short emergency SMS (under ~160 chars).
    Uses only GSM-7 characters to stay within a single 160-char SMS segment.
    (Emojis force UCS-2 encoding and drop the limit to 70 chars -- Twilio error 30044.)
    """

    short_id = str(incident_id)[:8].upper()
    sev = f"{severity}/10" if severity is not None else "N/A"

    msg = (
        f"SwarmAI ALERT [{short_id}]\n"
        f"{disaster_type} | Sev {sev}\n"
        f"{location}"
    )

    if summary:
        remaining = 155 - len(msg) - 1
        if remaining > 15:
            msg += f"\n{summary[:remaining].rstrip()}"

    return msg