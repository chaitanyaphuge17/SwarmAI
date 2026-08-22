import urllib.parse
import json
import logging
import requests
from typing import Dict, Any, Tuple, Optional

# Setup local logger
logger = logging.getLogger("GeoValidationService")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    formatter = logging.Formatter('💾 [%(levelname)s] GeoValidationService: %(message)s')
    ch.setFormatter(formatter)
    logger.addHandler(ch)

_GEOCODE_CACHE = {}

def geocode_nominatim(location: str, timeout: int = 5) -> Optional[Dict[str, Any]]:
    loc_clean = location.strip()
    if not loc_clean:
        return None
        
    if loc_clean in _GEOCODE_CACHE:
        logger.info(f"Geocoding cache hit for '{loc_clean}'")
        return _GEOCODE_CACHE[loc_clean]

    logger.info(f"Geocoding '{loc_clean}' via Nominatim API...")
    query = urllib.parse.urlencode({
        "q": loc_clean,
        "format": "json",
        "limit": 1,
        "addressdetails": 1
    })
    url = f"https://nominatim.openstreetmap.org/search?{query}"
    
    try:
        response = requests.get(
            url,
            headers={"User-Agent": "SwarmAI-Disaster-System/1.0"},
            timeout=timeout
        )
        if response.status_code != 200:
            logger.warning(f"Nominatim returned status code {response.status_code}")
            return None
            
        data = response.json()
        if not data:
            logger.warning(f"No geocoding results for '{loc_clean}'")
            return None
            
        result = data[0]
        lat = float(result["lat"])
        lon = float(result["lon"])
        address = result.get("address", {})
        
        state = address.get("state", address.get("region", ""))
        country = address.get("country", "")
        display_name = result.get("display_name", "")
        
        geo_data = {
            "latitude": lat,
            "longitude": lon,
            "state": state,
            "country": country,
            "display_name": display_name
        }
        _GEOCODE_CACHE[loc_clean] = geo_data
        return geo_data
    except Exception as e:
        logger.error(f"Geocoding error for '{loc_clean}': {e}")
        return None


def fetch_weather_openmeteo(lat: float, lon: float, timeout: int = 5) -> Optional[Dict[str, Any]]:
    logger.info(f"Fetching weather for coordinates ({lat}, {lon}) via Open-Meteo...")
    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}&"
        f"current=temperature_2m,rain,wind_speed_10m&"
        f"daily=rain_sum,precipitation_sum&timezone=auto&past_days=3"
    )
    
    try:
        response = requests.get(url, timeout=timeout)
        if response.status_code != 200:
            logger.warning(f"Open-Meteo returned status code {response.status_code}")
            return None
            
        data = response.json()
        current = data.get("current", {})
        daily = data.get("daily", {})
        
        current_temp = float(current.get("temperature_2m", 0.0))
        current_rain = float(current.get("rain", 0.0))
        wind_speed = float(current.get("wind_speed_10m", 0.0))
        
        # Calculate recent rainfall sum over the past days (plus today)
        rain_sums = daily.get("rain_sum", []) or daily.get("precipitation_sum", []) or []
        recent_rain = sum(float(r) for r in rain_sums if r is not None)
        
        return {
            "current_temp": current_temp,
            "current_rain": current_rain,
            "wind_speed": wind_speed,
            "recent_rain": recent_rain
        }
    except Exception as e:
        logger.error(f"Weather API error: {e}")
        return None


def fetch_elevation_openelevation(lat: float, lon: float, timeout: int = 5) -> Optional[float]:
    logger.info(f"Fetching elevation for coordinates ({lat}, {lon}) via Open-Elevation...")
    url = f"https://api.open-elevation.com/api/v1/lookup?locations={lat},{lon}"
    
    try:
        response = requests.get(url, timeout=timeout)
        if response.status_code != 200:
            logger.warning(f"Open-Elevation returned status code {response.status_code}")
            return None
            
        data = response.json()
        results = data.get("results", [])
        if not results:
            return None
            
        return float(results[0].get("elevation", 0.0))
    except Exception as e:
        logger.error(f"Elevation API error: {e}")
        return None


DISASTER_RULES = {
    "Flood": {
        "requiresRain": True,
        "rainThreshold": 20,
        "floodProneStates": [
            "Assam",
            "Kerala",
            "Punjab",
            "Gujarat",
            "Odisha",
            "West Bengal",
            "Bihar",
            "Uttar Pradesh",
            "Tamil Nadu",
            "Maharashtra"
        ]
    },
    "Landslide": {
        "requiresMountain": True,
        "requiresRain": True,
        "minElevation": 300
    },
    "Cyclone": {
        "requiresCoast": True
    },
    "Avalanche": {
        "minElevation": 2000,
        "maxTemperature": 5
    },
    "Wildfire": {
        "maxRain": 5,
        "highTemperature": 30
    }
}

COASTAL_KEYWORDS = {"coast", "beach", "ocean", "sea", "marine", "bay", "gulf", "port", "island", "shore", "odisha", "goa", "mumbai"}
MOUNTAIN_KEYWORDS = {"mountain", "hill", "ghat", "ridge", "peak", "valley", "himalaya", "range", "pass", "shimla", "ladakh", "srinagar"}

def normalize_to_rule_disaster(disaster: str) -> Optional[str]:
    d_clean = disaster.lower().strip()
    if "flood" in d_clean:
        return "Flood"
    if "landslide" in d_clean or "mudslide" in d_clean:
        return "Landslide"
    if "cyclone" in d_clean or "hurricane" in d_clean or "typhoon" in d_clean or "tsunami" in d_clean:
        return "Cyclone"
    if "avalanche" in d_clean or "snowslide" in d_clean:
        return "Avalanche"
    if "wildfire" in d_clean or "forest fire" in d_clean or "fire" in d_clean:
        return "Wildfire"
    return None


class GeoValidationService:
    @staticmethod
    async def validate_geographic_plausibility(location: str, disaster_type: str) -> Dict[str, Any]:
        """
        Validates the geographic plausibility of a disaster at a given location.
        Returns a dict: {valid: bool, confidence: float, reason: str}
        """
        if not location or not location.strip():
            return {
                "valid": False,
                "confidence": 0.0,
                "reason": "Incident location is missing."
            }
            
        rule_disaster = normalize_to_rule_disaster(disaster_type)
        # If disaster has no specific validation rules, default to VALID generously
        if not rule_disaster:
            logger.info(f"No specific validation rules defined for '{disaster_type}'. Generously accepting.")
            return {
                "valid": True,
                "confidence": 0.95,
                "reason": f"Disaster type '{disaster_type}' is plausible anywhere."
            }

        # Step 1: Geocoding
        geo_data = geocode_nominatim(location)
        if not geo_data:
            logger.warning(f"Geocoding failed for location: '{location}'")
            return {
                "valid": False,
                "confidence": 0.0,
                "reason": f"Failed to geocode incident location: '{location}'."
            }
            
        lat = geo_data["latitude"]
        lon = geo_data["longitude"]
        state = geo_data["state"]
        country = geo_data["country"]
        display_name = geo_data["display_name"].lower()
        
        # Step 2: Weather & Elevation API calls
        weather = fetch_weather_openmeteo(lat, lon)
        if not weather:
            logger.warning(f"Weather lookup failed for coordinates ({lat}, {lon})")
            return {
                "valid": False,
                "confidence": 0.0,
                "reason": "Failed to retrieve real-time weather data."
            }
            
        elevation = fetch_elevation_openelevation(lat, lon)
        if elevation is None:
            logger.warning(f"Elevation lookup failed for coordinates ({lat}, {lon})")
            return {
                "valid": False,
                "confidence": 0.0,
                "reason": "Failed to retrieve elevation data."
            }

        # Extract values
        current_temp = weather["current_temp"]
        current_rain = weather["current_rain"]
        wind_speed = weather["wind_speed"]
        recent_rain = weather["recent_rain"]
        
        # Determine OSM-based tags from display name and elevation
        is_coastal = any(kw in display_name for kw in COASTAL_KEYWORDS)
        is_mountainous = any(kw in display_name for kw in MOUNTAIN_KEYWORDS) or elevation >= 500
        
        rule = DISASTER_RULES[rule_disaster]
        valid = False
        reason = ""
        confidence = 0.95
        
        # Rule Evaluation
        if rule_disaster == "Flood":
            rain_ok = (recent_rain >= rule["rainThreshold"] or current_rain > 5)
            state_ok = any(s.lower() in state.lower() for s in rule["floodProneStates"]) if state else False
            
            if rain_ok or state_ok:
                valid = True
                reasons = []
                if rain_ok: reasons.append(f"significant recent rainfall ({recent_rain:.1f}mm)")
                if state_ok: reasons.append(f"region-specific flood risk in {state}")
                reason = f"Flood is geographically plausible for {location} due to " + " and ".join(reasons) + "."
            else:
                reason = f"Flood is geographically implausible for {location} because there is insufficient rainfall ({recent_rain:.1f}mm) and the state '{state}' is not designated as high flood risk."
                confidence = 0.98

        elif rule_disaster == "Landslide":
            elevation_ok = (elevation >= rule["minElevation"])
            mountain_ok = is_mountainous
            rain_ok = (recent_rain > 5 or current_rain > 0)
            
            if (elevation_ok or mountain_ok) and rain_ok:
                valid = True
                reason = f"Landslide is geographically plausible for {location} due to mountainous/hilly terrain (elevation: {elevation:.1f}m) and recent rainfall ({recent_rain:.1f}mm)."
            else:
                if not (elevation_ok or mountain_ok):
                    reason = f"Landslide is geographically implausible for {location} because the terrain is flat (elevation: {elevation:.1f}m is below threshold of {rule['minElevation']}m)."
                else:
                    reason = f"Landslide is geographically implausible for {location} despite high elevation because there is insufficient recent rainfall ({recent_rain:.1f}mm) to trigger soil instability."
                confidence = 0.98

        elif rule_disaster == "Cyclone":
            if is_coastal:
                valid = True
                reason = f"Cyclone is geographically plausible for {location} due to coastal proximity."
            else:
                reason = f"Cyclone is geographically implausible for {location} because it is located inland far from coastal/oceanic waters."
                confidence = 0.98

        elif rule_disaster == "Avalanche":
            elevation_ok = (elevation >= rule["minElevation"])
            temp_ok = (current_temp <= rule["maxTemperature"])
            
            if elevation_ok and temp_ok:
                valid = True
                reason = f"Avalanche is geographically plausible for {location} due to high elevation ({elevation:.1f}m) and sub-freezing temperatures ({current_temp:.1f}°C)."
            else:
                if not elevation_ok:
                    reason = f"Avalanche is geographically implausible for {location} because the elevation ({elevation:.1f}m) is too low for alpine snowpack."
                else:
                    reason = f"Avalanche is geographically implausible for {location} because the temperature ({current_temp:.1f}°C) is too warm to sustain avalanche conditions."
                confidence = 0.98

        elif rule_disaster == "Wildfire":
            rain_ok = (recent_rain <= rule["maxRain"])
            temp_ok = (current_temp >= rule["highTemperature"])
            
            if rain_ok and temp_ok:
                valid = True
                reason = f"Wildfire is geographically plausible for {location} due to dry conditions (recent rain: {recent_rain:.1f}mm) and high temperature ({current_temp:.1f}°C)."
            else:
                if not rain_ok:
                    reason = f"Wildfire is geographically implausible for {location} due to recent heavy rainfall ({recent_rain:.1f}mm) dampening vegetation."
                else:
                    reason = f"Wildfire is geographically implausible for {location} because the temperature ({current_temp:.1f}°C) is below the threshold of {rule['highTemperature']}°C required for critical ignition."
                confidence = 0.98

        logger.info(
            f"🌍 GEO VALIDATION RESULT | "
            f"Location: {location} ({lat}, {lon}) | "
            f"Disaster: {disaster_type} -> {rule_disaster} | "
            f"Weather: {current_temp}°C, {current_rain}mm, recent rain: {recent_rain}mm | "
            f"Elevation: {elevation}m | "
            f"Decision: {valid} | "
            f"Reason: {reason}"
        )
        
        return {
            "valid": valid,
            "confidence": confidence,
            "reason": reason
        }
