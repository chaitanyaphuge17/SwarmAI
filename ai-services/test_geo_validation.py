"""
Geo Validation Service — Full Acceptance-Criteria Test Suite
============================================================

Tests GeoValidationService.validate_geographic_plausibility() directly,
with all external HTTP calls mocked so the suite runs offline and fast.

Acceptance criteria covered:

VALID scenarios:
  TC01 – Flood in Ahmedabad with supporting rainfall
  TC02 – Landslide in Shimla (mountainous + rain)
  TC03 – Cyclone in Odisha (coastal)
  TC04 – Avalanche in Ladakh (high elevation + cold)
  TC05 – Wildfire in Rajasthan (dry + hot)
  TC06 – Disaster type with no rules → always VALID

INVALID scenarios:
  TC07 – Avalanche in Ahmedabad (low elevation / warm)
  TC08 – Cyclone in Chandigarh (inland)
  TC09 – Landslide in Delhi (flat, no rain)
  TC10 – Wildfire during heavy rainfall

FAILURE / ERROR scenarios:
  TC11 – Geocoding failure → INVALID
  TC12 – Weather API failure → INVALID
  TC13 – Primary elevation API failure → fallback tried → success
  TC14 – Both elevation APIs fail → INVALID
  TC15 – Empty location → INVALID

MULTIPLE-IMAGE integration:
  TC16 – Mixed image uploads; each image gets its own independent result
"""

import asyncio
import io
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from PIL import Image


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def run(coro):
    """Utility to run a coroutine in the test runner."""
    return asyncio.get_event_loop().run_until_complete(coro)


def _geo(lat=23.0225, lon=72.5714, state="Gujarat", country="India",
         display_name="ahmedabad, gujarat, india"):
    return {
        "latitude": lat,
        "longitude": lon,
        "state": state,
        "country": country,
        "display_name": display_name,
    }


def _weather(temp=35.0, rain_now=0.0, wind=12.0, rain_3d=5.0):
    return {
        "current_temp": temp,
        "current_rain": rain_now,
        "wind_speed": wind,
        "recent_rain": rain_3d,
    }


def _make_image_bytes(color=(0, 120, 255), fmt="JPEG") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (224, 224), color=color).save(buf, format=fmt)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Test suite
# ---------------------------------------------------------------------------

class TestGeoValidationService(unittest.TestCase):

    def _run_validate(self, location, disaster_type,
                      geo=None, weather=None, elevation=None,
                      elevation_fallback=None, incident_id=""):
        """
        Helper that patches all three external I/O functions and runs validate.
        If a value is None the patch makes the function return None (simulating failure).
        """
        from services.geo_validation_service import GeoValidationService

        with patch(
            "services.geo_validation_service._geocode_nominatim_sync",
            return_value=geo,
        ), patch(
            "services.geo_validation_service._fetch_weather_sync",
            return_value=weather,
        ), patch(
            "services.geo_validation_service._fetch_elevation_opentopo_sync",
            return_value=elevation,
        ), patch(
            "services.geo_validation_service._fetch_elevation_openelevation_sync",
            return_value=elevation_fallback,
        ):
            return run(
                GeoValidationService.validate_geographic_plausibility(
                    location, disaster_type, incident_id=incident_id
                )
            )

    # -----------------------------------------------------------------------
    # TC01 — Flood in Ahmedabad (Gujarat flood-prone state + heavy rain)
    # -----------------------------------------------------------------------
    def test_tc01_flood_ahmedabad_valid(self):
        result = self._run_validate(
            location="Ahmedabad, Gujarat, India",
            disaster_type="Flood",
            geo=_geo(state="Gujarat"),
            weather=_weather(temp=32, rain_now=2.0, rain_3d=45.0),  # > 20 mm threshold
            elevation=55.0,
        )
        self.assertTrue(result["valid"], f"TC01 failed: {result['reason']}")
        self.assertGreater(result["confidence"], 0.5)
        self.assertIn("plausible", result["reason"].lower())

    # -----------------------------------------------------------------------
    # TC02 — Landslide in Shimla (mountainous + rain)
    # -----------------------------------------------------------------------
    def test_tc02_landslide_shimla_valid(self):
        result = self._run_validate(
            location="Shimla, Himachal Pradesh, India",
            disaster_type="Landslide",
            geo=_geo(lat=31.1048, lon=77.1734, state="Himachal Pradesh",
                     display_name="shimla, himachal pradesh, india"),
            weather=_weather(temp=18, rain_now=3.0, rain_3d=30.0),
            elevation=2200.0,  # well above 300 m threshold; also in MOUNTAIN_KEYWORDS
        )
        self.assertTrue(result["valid"], f"TC02 failed: {result['reason']}")
        self.assertIn("plausible", result["reason"].lower())

    # -----------------------------------------------------------------------
    # TC03 — Cyclone in Odisha (coastal)
    # -----------------------------------------------------------------------
    def test_tc03_cyclone_odisha_valid(self):
        result = self._run_validate(
            location="Bhubaneswar, Odisha, India",
            disaster_type="Cyclone",
            geo=_geo(lat=20.2961, lon=85.8245, state="Odisha",
                     display_name="bhubaneswar, odisha, india"),
            weather=_weather(temp=28, wind=60.0, rain_now=10.0, rain_3d=80.0),
            elevation=45.0,
        )
        # "odisha" is in COASTAL_KEYWORDS
        self.assertTrue(result["valid"], f"TC03 failed: {result['reason']}")
        self.assertIn("coastal", result["reason"].lower())

    # -----------------------------------------------------------------------
    # TC04 — Avalanche in Ladakh (high elevation + cold)
    # -----------------------------------------------------------------------
    def test_tc04_avalanche_ladakh_valid(self):
        result = self._run_validate(
            location="Leh, Ladakh, India",
            disaster_type="Avalanche",
            geo=_geo(lat=34.1526, lon=77.5771, state="Ladakh",
                     display_name="leh, ladakh, india"),
            weather=_weather(temp=-3.0, rain_now=0.0, rain_3d=0.0),  # cold
            elevation=3505.0,  # well above 2000 m
        )
        self.assertTrue(result["valid"], f"TC04 failed: {result['reason']}")
        self.assertIn("plausible", result["reason"].lower())

    # -----------------------------------------------------------------------
    # TC05 — Wildfire in Rajasthan (dry + hot)
    # -----------------------------------------------------------------------
    def test_tc05_wildfire_rajasthan_valid(self):
        result = self._run_validate(
            location="Jodhpur, Rajasthan, India",
            disaster_type="Wildfire",
            geo=_geo(lat=26.2389, lon=73.0243, state="Rajasthan",
                     display_name="jodhpur, rajasthan, india"),
            weather=_weather(temp=42.0, rain_now=0.0, rain_3d=1.0),  # dry + hot
            elevation=231.0,
        )
        self.assertTrue(result["valid"], f"TC05 failed: {result['reason']}")
        self.assertIn("plausible", result["reason"].lower())

    # -----------------------------------------------------------------------
    # TC06 — Unknown disaster type → no rules → VALID
    # -----------------------------------------------------------------------
    def test_tc06_unknown_disaster_no_rules_valid(self):
        from services.geo_validation_service import GeoValidationService
        # No mocking needed — short-circuits before any I/O
        result = run(
            GeoValidationService.validate_geographic_plausibility(
                "Anywhere, India", "Earthquake"
            )
        )
        self.assertTrue(result["valid"])
        self.assertGreaterEqual(result["confidence"], 0.90)

    # -----------------------------------------------------------------------
    # TC07 — Avalanche in Ahmedabad (elevation too low / temperature too warm)
    # -----------------------------------------------------------------------
    def test_tc07_avalanche_ahmedabad_invalid(self):
        result = self._run_validate(
            location="Ahmedabad, Gujarat, India",
            disaster_type="Avalanche",
            geo=_geo(state="Gujarat"),
            weather=_weather(temp=35.0),  # way too warm
            elevation=55.0,               # way too low
        )
        self.assertFalse(result["valid"], f"TC07 should be invalid: {result['reason']}")
        self.assertIn("implausible", result["reason"].lower())

    # -----------------------------------------------------------------------
    # TC08 — Cyclone in Chandigarh (inland)
    # -----------------------------------------------------------------------
    def test_tc08_cyclone_chandigarh_invalid(self):
        result = self._run_validate(
            location="Chandigarh, India",
            disaster_type="Cyclone",
            geo=_geo(lat=30.7333, lon=76.7794, state="Chandigarh",
                     display_name="chandigarh, india"),
            weather=_weather(temp=30, wind=20.0),
            elevation=321.0,
        )
        self.assertFalse(result["valid"], f"TC08 should be invalid: {result['reason']}")
        self.assertIn("implausible", result["reason"].lower())
        self.assertIn("inland", result["reason"].lower())

    # -----------------------------------------------------------------------
    # TC09 — Landslide in Delhi (flat terrain, no rain)
    # -----------------------------------------------------------------------
    def test_tc09_landslide_delhi_invalid(self):
        result = self._run_validate(
            location="New Delhi, India",
            disaster_type="Landslide",
            geo=_geo(lat=28.6139, lon=77.2090, state="Delhi",
                     display_name="new delhi, delhi, india"),
            weather=_weather(temp=38.0, rain_now=0.0, rain_3d=0.0),  # no rain
            elevation=216.0,  # below 300 m threshold, not mountainous
        )
        self.assertFalse(result["valid"], f"TC09 should be invalid: {result['reason']}")
        self.assertIn("implausible", result["reason"].lower())

    # -----------------------------------------------------------------------
    # TC10 — Wildfire during heavy rainfall
    # -----------------------------------------------------------------------
    def test_tc10_wildfire_heavy_rain_invalid(self):
        result = self._run_validate(
            location="Shimla, Himachal Pradesh, India",
            disaster_type="Wildfire",
            geo=_geo(lat=31.1048, lon=77.1734, state="Himachal Pradesh",
                     display_name="shimla, himachal pradesh, india"),
            weather=_weather(temp=22.0, rain_now=5.0, rain_3d=80.0),  # very wet
            elevation=2200.0,
        )
        self.assertFalse(result["valid"], f"TC10 should be invalid: {result['reason']}")
        self.assertIn("rainfall", result["reason"].lower())

    # -----------------------------------------------------------------------
    # TC11 — Geocoding failure → INVALID
    # -----------------------------------------------------------------------
    def test_tc11_geocoding_failure_invalid(self):
        result = self._run_validate(
            location="SomeNonExistentPlace123XYZ",
            disaster_type="Flood",
            geo=None,           # simulate geocoding failure
            weather=_weather(),
            elevation=10.0,
        )
        self.assertFalse(result["valid"], "TC11: geocoding failure should yield INVALID")
        self.assertEqual(result["confidence"], 0.0)
        self.assertIn("geocode", result["reason"].lower())

    # -----------------------------------------------------------------------
    # TC12 — Weather API failure → INVALID
    # -----------------------------------------------------------------------
    def test_tc12_weather_api_failure_invalid(self):
        result = self._run_validate(
            location="Ahmedabad, Gujarat, India",
            disaster_type="Flood",
            geo=_geo(state="Gujarat"),
            weather=None,       # simulate weather API failure
            elevation=55.0,
        )
        self.assertFalse(result["valid"], "TC12: weather failure should yield INVALID")
        self.assertEqual(result["confidence"], 0.0)
        self.assertIn("weather", result["reason"].lower())

    # -----------------------------------------------------------------------
    # TC13 — Primary elevation fails but fallback succeeds → continues normally
    # -----------------------------------------------------------------------
    def test_tc13_elevation_primary_fails_fallback_succeeds(self):
        result = self._run_validate(
            location="Ahmedabad, Gujarat, India",
            disaster_type="Flood",
            geo=_geo(state="Gujarat"),
            weather=_weather(rain_3d=40.0),
            elevation=None,          # primary fails
            elevation_fallback=55.0, # fallback succeeds
        )
        # With fallback elevation available, Flood validation should proceed
        self.assertTrue(
            result["valid"],
            f"TC13: fallback elevation should allow validation to continue: {result['reason']}"
        )

    # -----------------------------------------------------------------------
    # TC14 — Both elevation APIs fail → INVALID
    # -----------------------------------------------------------------------
    def test_tc14_all_elevation_apis_fail_invalid(self):
        result = self._run_validate(
            location="Ahmedabad, Gujarat, India",
            disaster_type="Flood",
            geo=_geo(state="Gujarat"),
            weather=_weather(),
            elevation=None,          # primary fails
            elevation_fallback=None, # fallback also fails
        )
        self.assertFalse(result["valid"], "TC14: all elevation failures should yield INVALID")
        self.assertEqual(result["confidence"], 0.0)
        self.assertIn("elevation", result["reason"].lower())

    # -----------------------------------------------------------------------
    # TC15 — Empty location string → INVALID
    # -----------------------------------------------------------------------
    def test_tc15_empty_location_invalid(self):
        from services.geo_validation_service import GeoValidationService
        result = run(
            GeoValidationService.validate_geographic_plausibility("", "Flood")
        )
        self.assertFalse(result["valid"])
        self.assertEqual(result["confidence"], 0.0)
        self.assertIn("missing", result["reason"].lower())

    # -----------------------------------------------------------------------
    # TC16 — Multiple images: each validated independently
    # -----------------------------------------------------------------------
    def test_tc16_multiple_images_independent_results(self):
        """
        Validates that a batch of 3 images (2 valid, 1 invalid) produces
        exactly 2 accepted and 1 rejected, independently of each other.
        """
        from services.image_validator import validate_disaster_images

        def _cls_disaster(label="flooded urban road", dtype="flood"):
            return {
                "vision_relevant": True,
                "predicted_label": label,
                "predicted_disaster_type": dtype,
                "confidence": 0.90,
                "disaster_score": 0.85,
                "non_disaster_score": 0.05,
                "strongest_disaster_label": label,
                "strongest_non_disaster_label": "normal photograph",
            }

        def _cls_non_disaster():
            return {
                "vision_relevant": False,
                "predicted_label": "normal photograph",
                "predicted_disaster_type": "non_disaster",
                "confidence": 0.95,
                "disaster_score": 0.02,
                "non_disaster_score": 0.88,
                "strongest_disaster_label": "flooded urban road",
                "strongest_non_disaster_label": "normal photograph",
            }

        _geo_valid = {
            "valid": True,
            "location_match": True,
            "confidence": 0.94,
            "reason": "Flood is plausible for Ahmedabad.",
        }

        images = [
            {"image_index": 1, "filename": "img1.jpg",
             "image_bytes": _make_image_bytes((0, 0, 200))},   # valid flood
            {"image_index": 2, "filename": "img2.jpg",
             "image_bytes": _make_image_bytes((200, 200, 0))}, # non-disaster
            {"image_index": 3, "filename": "img3.jpg",
             "image_bytes": _make_image_bytes((0, 200, 0))},   # valid flood
        ]

        # Alternate cls results: disaster / non-disaster / disaster
        call_count = [0]

        def _side_effect_cls(img):
            i = call_count[0]
            call_count[0] += 1
            return [_cls_disaster(), _cls_non_disaster(), _cls_disaster()][i]

        with patch(
            "services.image_validator.classify_image_locally",
            side_effect=_side_effect_cls,
        ), patch(
            "services.image_validator.groq_geo_validate",
            new=AsyncMock(return_value=_geo_valid),
        ):
            summary = run(
                validate_disaster_images(
                    images,
                    location="Ahmedabad, Gujarat, India",
                    user_description="flood",
                    reported_disaster="Flood",
                )
            )

        self.assertEqual(summary["total_images"], 3)
        self.assertEqual(summary["accepted_images"], 2, "Expected 2 accepted images")
        self.assertEqual(summary["rejected_images"], 1, "Expected 1 rejected image")
        # Results must reconcile exactly
        self.assertEqual(
            summary["accepted_images"] + summary["rejected_images"],
            summary["total_images"],
        )


# ---------------------------------------------------------------------------
# Additional normaliser unit tests
# ---------------------------------------------------------------------------

class TestNormalizeToRuleDisaster(unittest.TestCase):

    def _normalize(self, text):
        from services.geo_validation_service import normalize_to_rule_disaster
        return normalize_to_rule_disaster(text)

    def test_flood_variants(self):
        for v in ["Flood", "flash flood", "FLOOD", "Urban Flood"]:
            self.assertEqual(self._normalize(v), "Flood", v)

    def test_landslide_variants(self):
        for v in ["Landslide", "mudslide", "LANDSLIDE"]:
            self.assertEqual(self._normalize(v), "Landslide", v)

    def test_cyclone_variants(self):
        for v in ["Cyclone", "hurricane", "typhoon", "Tsunami"]:
            self.assertEqual(self._normalize(v), "Cyclone", v)

    def test_avalanche_variants(self):
        for v in ["Avalanche", "snowslide", "AVALANCHE"]:
            self.assertEqual(self._normalize(v), "Avalanche", v)

    def test_wildfire_variants(self):
        for v in ["Wildfire", "forest fire", "Fire"]:
            self.assertEqual(self._normalize(v), "Wildfire", v)

    def test_unknown_returns_none(self):
        for v in ["earthquake", "collapse", "accident", "unknown", ""]:
            self.assertIsNone(self._normalize(v), v)


# ---------------------------------------------------------------------------
# Config unit tests
# ---------------------------------------------------------------------------

class TestGeoRulesConfig(unittest.TestCase):

    def test_disaster_rules_have_required_keys(self):
        from config.geo_rules import DISASTER_RULES
        self.assertIn("Flood", DISASTER_RULES)
        self.assertIn("rainThreshold", DISASTER_RULES["Flood"])
        self.assertIn("floodProneStates", DISASTER_RULES["Flood"])
        self.assertIn("Landslide", DISASTER_RULES)
        self.assertIn("minElevation", DISASTER_RULES["Landslide"])
        self.assertIn("Cyclone", DISASTER_RULES)
        self.assertIn("Avalanche", DISASTER_RULES)
        self.assertIn("minElevation", DISASTER_RULES["Avalanche"])
        self.assertIn("Wildfire", DISASTER_RULES)

    def test_coastal_keywords_not_empty(self):
        from config.geo_rules import COASTAL_KEYWORDS
        self.assertGreater(len(COASTAL_KEYWORDS), 5)
        self.assertIn("odisha", COASTAL_KEYWORDS)
        self.assertIn("goa", COASTAL_KEYWORDS)

    def test_mountain_keywords_not_empty(self):
        from config.geo_rules import MOUNTAIN_KEYWORDS
        self.assertGreater(len(MOUNTAIN_KEYWORDS), 5)
        self.assertIn("shimla", MOUNTAIN_KEYWORDS)
        self.assertIn("ladakh", MOUNTAIN_KEYWORDS)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main(verbosity=2)
