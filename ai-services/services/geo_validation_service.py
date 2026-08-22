"""
Geo Validation Service
======================
Answers one question:
  "Is this disaster geographically plausible for this incident location?"

Pipeline:
  1. Geocode the location via OpenStreetMap Nominatim (cached).
  2. Fetch real environmental data:
     - Weather  → Open-Meteo (free, no key needed)
     - Elevation → Open-Topo-Data primary, Open-Elevation fallback
  3. Evaluate deterministic rules from config/geo_rules.py.
  4. Return { valid, confidence, reason }.

Error policy: any external API failure → { valid: False }.
Never default to VALID on errors.

All I/O is run via asyncio.to_thread() to avoid blocking the FastAPI
event loop.
"""

import asyncio
import logging
import urllib.parse
from typing import Any, Dict, Optional

import requests

from config.geo_rules import COASTAL_KEYWORDS, DISASTER_RULES, MOUNTAIN_KEYWORDS

# ---------------------------------------------------------------------------
# Logger
# ---------------------------------------------------------------------------

logger = logging.getLogger("GeoValidationService")
logger.setLevel(logging.INFO)
if not logger.handlers:
    _ch = logging.StreamHandler()
    _ch.setFormatter(
        logging.Formatter("🌍 [%(levelname)s] GeoValidationService: %(message)s")
    )
    logger.addHandler(_ch)

# ---------------------------------------------------------------------------
# In-memory geocoding cache  (process-lifetime; keyed by normalised location)
# ---------------------------------------------------------------------------

_GEOCODE_CACHE: Dict[str, Dict[str, Any]] = {}


# ===========================================================================
# SYNC HTTP HELPERS  (called via asyncio.to_thread — never await directly)
# ===========================================================================


def _geocode_nominatim_sync(location: str, timeout: int = 6) -> Optional[Dict[str, Any]]:
    """Synchronous Nominatim geocoding.  Called from async context via to_thread."""
    loc_clean = location.strip()
    if not loc_clean:
        return None

    if loc_clean in _GEOCODE_CACHE:
        logger.info(f"Cache hit for '{loc_clean}'")
        return _GEOCODE_CACHE[loc_clean]

    logger.info(f"Geocoding '{loc_clean}' via Nominatim…")
    params = urllib.parse.urlencode(
        {"q": loc_clean, "format": "json", "limit": 1, "addressdetails": 1}
    )
    url = f"https://nominatim.openstreetmap.org/search?{params}"

    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "SwarmAI-Disaster-System/1.0"},
            timeout=timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data:
            logger.warning(f"No Nominatim results for '{loc_clean}'")
            return None

        result = data[0]
        address = result.get("address", {})
        geo_data: Dict[str, Any] = {
            "latitude": float(result["lat"]),
            "longitude": float(result["lon"]),
            "state": address.get("state", address.get("region", "")),
            "country": address.get("country", ""),
            "display_name": result.get("display_name", ""),
        }
        _GEOCODE_CACHE[loc_clean] = geo_data
        return geo_data
    except Exception as exc:
        logger.error(f"Geocoding error for '{loc_clean}': {exc}")
        return None


def _fetch_weather_sync(lat: float, lon: float, timeout: int = 6) -> Optional[Dict[str, Any]]:
    """Synchronous Open-Meteo weather fetch.  Called via to_thread."""
    logger.info(f"Fetching weather for ({lat:.4f}, {lon:.4f}) via Open-Meteo…")
    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,rain,wind_speed_10m"
        f"&daily=rain_sum,precipitation_sum"
        f"&timezone=auto&past_days=3"
    )
    try:
        resp = requests.get(url, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()

        current = data.get("current", {})
        daily = data.get("daily", {})

        rain_sums = daily.get("rain_sum") or daily.get("precipitation_sum") or []
        recent_rain = sum(float(r) for r in rain_sums if r is not None)

        return {
            "current_temp": float(current.get("temperature_2m", 0.0)),
            "current_rain": float(current.get("rain", 0.0)),
            "wind_speed": float(current.get("wind_speed_10m", 0.0)),
            "recent_rain": recent_rain,
        }
    except Exception as exc:
        logger.error(f"Weather API error: {exc}")
        return None


def _fetch_elevation_opentopo_sync(lat: float, lon: float, timeout: int = 6) -> Optional[float]:
    """Primary elevation source: open-topo-data.org (SRTM 90 m).  Called via to_thread."""
    logger.info(f"Fetching elevation for ({lat:.4f}, {lon:.4f}) via Open-Topo-Data…")
    url = f"https://api.opentopodata.org/v1/srtm90m?locations={lat},{lon}"
    try:
        resp = requests.get(url, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        if results and results[0].get("elevation") is not None:
            return float(results[0]["elevation"])
        return None
    except Exception as exc:
        logger.warning(f"Open-Topo-Data elevation error: {exc}")
        return None


def _fetch_elevation_openelevation_sync(lat: float, lon: float, timeout: int = 6) -> Optional[float]:
    """Fallback elevation source: open-elevation.com.  Called via to_thread."""
    logger.info(f"Fallback elevation fetch for ({lat:.4f}, {lon:.4f}) via Open-Elevation…")
    url = f"https://api.open-elevation.com/api/v1/lookup?locations={lat},{lon}"
    try:
        resp = requests.get(url, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        if results:
            return float(results[0].get("elevation", 0.0))
        return None
    except Exception as exc:
        logger.error(f"Open-Elevation fallback error: {exc}")
        return None


# ===========================================================================
# DISASTER TYPE NORMALISER
# ===========================================================================


def normalize_to_rule_disaster(disaster: str) -> Optional[str]:
    """
    Maps a raw detected disaster string to one of the keys in DISASTER_RULES.
    Returns None if no matching rule set exists.
    """
    d = disaster.lower().strip()
    if "flood" in d:
        return "Flood"
    if "landslide" in d or "mudslide" in d:
        return "Landslide"
    if "cyclone" in d or "hurricane" in d or "typhoon" in d or "tsunami" in d:
        return "Cyclone"
    if "avalanche" in d or "snowslide" in d:
        return "Avalanche"
    if "wildfire" in d or "forest fire" in d or "fire" in d:
        return "Wildfire"
    return None


# ===========================================================================
# GEO VALIDATION SERVICE
# ===========================================================================


class GeoValidationService:
    """
    Validates whether a reported disaster is geographically plausible
    for the incident location using real geocoding, weather, and elevation data
    evaluated through a deterministic rule engine.
    """

    @staticmethod
    async def validate_geographic_plausibility(
        location: str,
        disaster_type: str,
        incident_id: str = "",
    ) -> Dict[str, Any]:
        """
        Validates the geographic plausibility of `disaster_type` at `location`.

        Parameters
        ----------
        location     : Human-readable incident location (e.g. "Ahmedabad, Gujarat, India")
        disaster_type: Disaster type string as detected by the vision agent.
        incident_id  : Optional incident identifier for log traceability.

        Returns
        -------
        {
            "valid":      bool,
            "confidence": float,
            "reason":     str,
        }
        """
        log_prefix = f"[incident:{incident_id}] " if incident_id else ""

        # ── Guard: empty location ────────────────────────────────────────────
        if not location or not location.strip():
            logger.warning(f"{log_prefix}Incident location is missing.")
            return {
                "valid": False,
                "confidence": 0.0,
                "reason": "Incident location is missing.",
            }

        rule_disaster = normalize_to_rule_disaster(disaster_type)

        # ── No rules → accept generously (e.g. earthquake, structural collapse) ──
        if not rule_disaster:
            logger.info(
                f"{log_prefix}No specific rules for '{disaster_type}'. Accepting as plausible."
            )
            return {
                "valid": True,
                "confidence": 0.95,
                "reason": f"Disaster type '{disaster_type}' has no geographic restrictions and is plausible anywhere.",
            }

        # ── Step 1: Geocoding (async-safe via to_thread) ─────────────────────
        geo_data = await asyncio.to_thread(_geocode_nominatim_sync, location)
        if not geo_data:
            logger.warning(f"{log_prefix}Geocoding failed for '{location}'.")
            return {
                "valid": False,
                "confidence": 0.0,
                "reason": f"Failed to geocode incident location: '{location}'.",
            }

        lat: float = geo_data["latitude"]
        lon: float = geo_data["longitude"]
        state: str = geo_data["state"]
        display_name: str = geo_data["display_name"].lower()

        # ── Step 2a: Weather (async-safe) ────────────────────────────────────
        weather = await asyncio.to_thread(_fetch_weather_sync, lat, lon)
        if not weather:
            logger.warning(f"{log_prefix}Weather fetch failed for ({lat}, {lon}).")
            return {
                "valid": False,
                "confidence": 0.0,
                "reason": "Failed to retrieve real-time weather data for the incident location.",
            }

        # ── Step 2b: Elevation — primary then fallback (async-safe) ──────────
        elevation = await asyncio.to_thread(_fetch_elevation_opentopo_sync, lat, lon)
        if elevation is None:
            logger.warning(
                f"{log_prefix}Primary elevation API failed. Trying fallback source…"
            )
            elevation = await asyncio.to_thread(_fetch_elevation_openelevation_sync, lat, lon)
        if elevation is None:
            logger.warning(f"{log_prefix}All elevation APIs failed for ({lat}, {lon}).")
            return {
                "valid": False,
                "confidence": 0.0,
                "reason": "Failed to retrieve elevation data for the incident location.",
            }

        # ── Step 3: Extract values ───────────────────────────────────────────
        current_temp: float = weather["current_temp"]
        current_rain: float = weather["current_rain"]
        wind_speed: float = weather["wind_speed"]
        recent_rain: float = weather["recent_rain"]

        is_coastal = any(kw in display_name for kw in COASTAL_KEYWORDS)
        is_mountainous = (
            any(kw in display_name for kw in MOUNTAIN_KEYWORDS) or elevation >= 500
        )

        # ── Step 4: Rule evaluation ──────────────────────────────────────────
        rule = DISASTER_RULES[rule_disaster]
        valid = False
        reason = ""
        confidence = 0.95

        if rule_disaster == "Flood":
            rain_ok = (recent_rain >= rule["rainThreshold"] or current_rain > 5)
            state_ok = (
                any(s.lower() in state.lower() for s in rule["floodProneStates"])
                if state else False
            )
            if rain_ok or state_ok:
                valid = True
                parts = []
                if rain_ok:
                    parts.append(f"significant recent rainfall ({recent_rain:.1f} mm)")
                if state_ok:
                    parts.append(f"historically high flood risk in {state}")
                reason = (
                    f"Flood is geographically plausible for {location} due to "
                    + " and ".join(parts) + "."
                )
            else:
                reason = (
                    f"Flood is geographically implausible for {location}: "
                    f"insufficient rainfall ({recent_rain:.1f} mm) and '{state}' "
                    f"is not a high-risk flood state."
                )
                confidence = 0.98

        elif rule_disaster == "Landslide":
            elevation_ok = elevation >= rule["minElevation"]
            mountain_ok = is_mountainous
            rain_ok = recent_rain > 5 or current_rain > 0
            if (elevation_ok or mountain_ok) and rain_ok:
                valid = True
                reason = (
                    f"Landslide is geographically plausible for {location}: "
                    f"{'mountainous' if mountain_ok else 'elevated'} terrain "
                    f"(elevation {elevation:.1f} m) combined with recent rainfall "
                    f"({recent_rain:.1f} mm)."
                )
            else:
                if not (elevation_ok or mountain_ok):
                    reason = (
                        f"Landslide is geographically implausible for {location}: "
                        f"terrain is flat (elevation {elevation:.1f} m, "
                        f"threshold {rule['minElevation']} m)."
                    )
                else:
                    reason = (
                        f"Landslide is geographically implausible for {location}: "
                        f"despite elevated terrain ({elevation:.1f} m), "
                        f"there is insufficient rainfall ({recent_rain:.1f} mm) "
                        f"to trigger soil instability."
                    )
                confidence = 0.98

        elif rule_disaster == "Cyclone":
            if is_coastal:
                valid = True
                reason = (
                    f"Cyclone is geographically plausible for {location}: "
                    f"coastal proximity confirmed."
                )
            else:
                reason = (
                    f"Cyclone is geographically implausible for {location}: "
                    f"the area is inland and lacks coastal/oceanic exposure."
                )
                confidence = 0.98

        elif rule_disaster == "Avalanche":
            elevation_ok = elevation >= rule["minElevation"]
            temp_ok = current_temp <= rule["maxTemperature"]
            if elevation_ok and temp_ok:
                valid = True
                reason = (
                    f"Avalanche is geographically plausible for {location}: "
                    f"high elevation ({elevation:.1f} m) with sub-zero / near-freezing "
                    f"temperature ({current_temp:.1f} °C)."
                )
            else:
                if not elevation_ok:
                    reason = (
                        f"Avalanche is geographically implausible for {location}: "
                        f"elevation ({elevation:.1f} m) is too low for alpine snowpack "
                        f"(minimum {rule['minElevation']} m required)."
                    )
                else:
                    reason = (
                        f"Avalanche is geographically implausible for {location}: "
                        f"temperature ({current_temp:.1f} °C) is too warm to sustain "
                        f"avalanche conditions (maximum {rule['maxTemperature']} °C allowed)."
                    )
                confidence = 0.98

        elif rule_disaster == "Wildfire":
            rain_ok = recent_rain <= rule["maxRain"]
            temp_ok = current_temp >= rule["highTemperature"]
            if rain_ok and temp_ok:
                valid = True
                reason = (
                    f"Wildfire is geographically plausible for {location}: "
                    f"dry conditions (recent rain {recent_rain:.1f} mm) and "
                    f"high temperature ({current_temp:.1f} °C)."
                )
            else:
                if not rain_ok:
                    reason = (
                        f"Wildfire is geographically implausible for {location}: "
                        f"recent heavy rainfall ({recent_rain:.1f} mm) has dampened vegetation."
                    )
                else:
                    reason = (
                        f"Wildfire is geographically implausible for {location}: "
                        f"temperature ({current_temp:.1f} °C) is below the critical "
                        f"ignition threshold of {rule['highTemperature']} °C."
                    )
                confidence = 0.98

        # ── Structured log ───────────────────────────────────────────────────
        logger.info(
            f"{log_prefix}"
            f"RESULT | location='{location}' ({lat:.4f}, {lon:.4f}) | "
            f"disaster='{disaster_type}' → rule='{rule_disaster}' | "
            f"weather: temp={current_temp}°C rain_now={current_rain}mm "
            f"rain_3d={recent_rain}mm wind={wind_speed}km/h | "
            f"elevation={elevation:.1f}m | "
            f"coastal={is_coastal} mountainous={is_mountainous} | "
            f"valid={valid} confidence={confidence} | "
            f"reason='{reason}'"
        )

        return {"valid": valid, "confidence": confidence, "reason": reason}
