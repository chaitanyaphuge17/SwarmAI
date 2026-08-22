"""
Geo Validation Rules Configuration
===================================
Centralised, maintainable configuration for the GeoValidationService.

To add a new disaster type:
  1. Add an entry to DISASTER_RULES with the required keys.
  2. Add the normalisation mapping in geo_validation_service.normalize_to_rule_disaster().

Rule keys:
  requiresRain (bool)   – disaster needs recent/current rainfall to be plausible
  rainThreshold (float) – minimum cumulative recent-rain in mm
  maxRain (float)       – maximum recent-rain in mm (dry conditions required)
  requiresMountain(bool)– disaster requires mountainous/hilly terrain
  requiresCoast (bool)  – disaster requires coastal / ocean-adjacent location
  minElevation (float)  – minimum elevation in metres
  maxTemperature(float) – maximum acceptable current temperature in °C
  highTemperature(float)– minimum temperature threshold in °C for ignition risk
  floodProneStates(list)– Indian states historically at high flood risk
"""

from typing import Dict, Any, Set

# ---------------------------------------------------------------------------
# Per-disaster validation rules
# ---------------------------------------------------------------------------

DISASTER_RULES: Dict[str, Dict[str, Any]] = {
    "Flood": {
        "requiresRain": True,
        "rainThreshold": 20,          # mm cumulative over past 3 days
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
            "Maharashtra",
            "Andhra Pradesh",
            "Telangana",
        ],
    },
    "Landslide": {
        "requiresMountain": True,
        "requiresRain": True,
        "minElevation": 300,          # metres above sea level
    },
    "Cyclone": {
        "requiresCoast": True,
    },
    "Avalanche": {
        "minElevation": 2000,         # metres — alpine snowpack threshold
        "maxTemperature": 5,          # °C — must be cold enough
    },
    "Wildfire": {
        "maxRain": 5,                 # mm — dry conditions required
        "highTemperature": 30,        # °C — ignition-risk threshold
    },
}

# ---------------------------------------------------------------------------
# OSM display-name keywords for coastal proximity detection
# ---------------------------------------------------------------------------

COASTAL_KEYWORDS: Set[str] = {
    "coast",
    "coastal",
    "beach",
    "ocean",
    "sea",
    "marine",
    "bay",
    "gulf",
    "port",
    "island",
    "shore",
    "shoreline",
    "odisha",
    "goa",
    "mumbai",
    "chennai",
    "visakhapatnam",
    "vizag",
    "kochi",
    "mangalore",
    "pondicherry",
    "puducherry",
    "kolkata",       # near Bay of Bengal
    "sunderban",
    "lakshadweep",
    "andaman",
    "nicobar",
}

# ---------------------------------------------------------------------------
# OSM display-name keywords for mountainous / hilly terrain detection
# ---------------------------------------------------------------------------

MOUNTAIN_KEYWORDS: Set[str] = {
    "mountain",
    "mountains",
    "hill",
    "hills",
    "ghat",
    "ghats",
    "ridge",
    "peak",
    "valley",
    "himalaya",
    "himalayas",
    "range",
    "pass",
    "shimla",
    "ladakh",
    "srinagar",
    "manali",
    "mussoorie",
    "nainital",
    "darjeeling",
    "gangtok",
    "sikkim",
    "arunachal",
    "uttarakhand",
    "dehradun",
    "ooty",
    "kodaikanal",
    "coorg",
    "munnar",
    "lonavala",
    "mahabaleshwar",
    "mussorie",
}
