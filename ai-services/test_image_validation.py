"""
Comprehensive Test Suite for Image Validation & Safety Pipeline
Tests all validation rules including Groq geo-consistency:
 1. Valid image -> accepted.
 2. Invalid image -> rejected.
 3. Validator returns { valid: false } -> rejected.
 4. Validator returns { valid: true } -> accepted.
 5. Validator returns missing valid field -> NOT accepted (false).
 6. Validator returns "false" string -> rejected (false).
 7. Validator returns "true" string -> accepted (true).
 8. Validator throws an error -> NOT accepted (false).
 9. Validator returns malformed data -> NOT accepted (false).
10. Multiple uploads contain both valid and invalid images -> independent results preserved.
11. Preserved validation structure for API and Admin Panel.
12. Failed/unknown validation can NEVER appear as VALID.
13. Groq geo-validation: flood + matching location -> VALID.
14. Groq geo-validation: flood + wrong location -> INVALID.
15. Groq geo-validation: wrong disaster type -> INVALID.
16. Groq geo-validation: timeout -> INVALID (never VALID).
17. Groq geo-validation: malformed JSON -> INVALID (never VALID).
18. Mixed multiple uploads with Groq: each image gets independent result.
"""

import io
import asyncio
import unittest
from unittest.mock import patch, MagicMock, AsyncMock
from PIL import Image
from fastapi import HTTPException

from services.image_validator import (
    validate_image_bytes,
    evaluate_geographic_plausibility,
    evaluate_description_consistency,
    process_single_image,
    validate_disaster_images,
    groq_geo_validate,
    LABEL_CANONICAL_MAP,
)
from services.disaster_analyzer import normalize_boolean, normalize_analysis


def create_dummy_image_bytes(color=(0, 0, 255), format="JPEG", size=(224, 224)) -> bytes:
    """Helper to generate valid dummy image bytes using Pillow."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Shared mock helpers
# ---------------------------------------------------------------------------

def _disaster_cls_result(label="flooded urban road", dtype="flood", disaster_score=0.85):
    return {
        "vision_relevant": True,
        "predicted_label": label,
        "predicted_disaster_type": dtype,
        "confidence": 0.90,
        "disaster_score": disaster_score,
        "non_disaster_score": 0.05,
        "strongest_disaster_label": label,
        "strongest_non_disaster_label": "ordinary landscape",
    }


def _non_disaster_cls_result():
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


def _groq_valid_result(location="Ahmedabad, Gujarat, India"):
    return {
        "valid": True,
        "location_match": True,
        "confidence": 0.94,
        "reason": f"Flood conditions are geographically plausible for {location} during monsoon season.",
    }


def _groq_invalid_location():
    return {
        "valid": False,
        "location_match": False,
        "confidence": 0.91,
        "reason": "The detected flood disaster is not consistent with the reported desert location.",
    }


def _groq_wrong_type():
    return {
        "valid": False,
        "location_match": False,
        "confidence": 0.88,
        "reason": "Detected disaster type does not match the reported disaster type.",
    }


class TestImageValidationPipeline(unittest.TestCase):

    # -----------------------------------------------------------------------
    # Existing tests (1-12)
    # -----------------------------------------------------------------------

    def test_01_valid_image_accepted(self):
        """1. Valid disaster image geo plausibility check passes."""
        geo_status, _ = evaluate_geographic_plausibility("Mumbai, India", "flood")
        self.assertEqual(geo_status, "geographically_plausible")

    def test_02_invalid_image_rejected(self):
        """2. Invalid/non-disaster image is rejected (vision gate)."""
        img_bytes = create_dummy_image_bytes()
        with patch("services.image_validator.classify_image_locally", return_value=_non_disaster_cls_result()):
            res = asyncio.run(process_single_image(
                {"image_index": 1, "filename": "selfie.jpg", "image_bytes": img_bytes}
            ))
            self.assertFalse(res["accepted"])
            self.assertFalse(res["relevant"])

    def test_03_validator_returns_valid_false_rejected(self):
        """3. Validator returns { valid: false } -> rejected."""
        self.assertFalse(normalize_boolean(False, default=True))
        self.assertFalse(normalize_boolean("false", default=True))

    def test_04_validator_returns_valid_true_accepted(self):
        """4. Validator returns { valid: true } -> accepted."""
        self.assertTrue(normalize_boolean(True, default=False))
        self.assertTrue(normalize_boolean("true", default=False))

    def test_05_missing_valid_field_not_accepted(self):
        """5. Validator returns missing valid field -> NOT accepted (false)."""
        self.assertFalse(normalize_boolean(None, default=False))
        parsed = normalize_analysis({"observations": ["test"]}, image_count=1)
        val_entry = parsed["image_validation"][0]
        self.assertFalse(val_entry["relevant"])

    def test_06_string_false_rejected(self):
        """6. Validator returns 'false' string -> rejected (false)."""
        self.assertFalse(normalize_boolean("false"))
        self.assertFalse(normalize_boolean("FALSE"))

    def test_07_string_true_accepted(self):
        """7. Validator returns 'true' string -> accepted (true)."""
        self.assertTrue(normalize_boolean("true"))
        self.assertTrue(normalize_boolean("TRUE"))

    def test_08_validator_throws_error_not_accepted(self):
        """8. Validator throws an error -> NOT accepted (false). Uses safe_print to avoid encoding errors."""
        img_bytes = create_dummy_image_bytes()
        with patch("services.image_validator.classify_image_locally", side_effect=Exception("Model crashed")):
            res = asyncio.run(process_single_image(
                {"image_index": 1, "filename": "error.jpg", "image_bytes": img_bytes}
            ))
            self.assertFalse(res["accepted"])
            self.assertFalse(res["relevant"])

    def test_09_malformed_data_not_accepted(self):
        """9. Validator receives malformed image bytes -> NOT accepted (false)."""
        bad_bytes = b"NOT_AN_IMAGE_FILE_BYTES"
        res = asyncio.run(process_single_image(
            {"image_index": 1, "filename": "bad.jpg", "image_bytes": bad_bytes}
        ))
        self.assertFalse(res["accepted"])
        self.assertFalse(res["relevant"])

    @patch("services.image_validator.groq_geo_validate", new_callable=AsyncMock)
    @patch("services.image_validator.classify_image_locally")
    def test_10_multiple_uploads_independent_results(self, mock_classify, mock_groq):
        """10. Multiple uploads: both valid and invalid images -> exact independent results preserved."""
        img1_bytes = create_dummy_image_bytes(color=(0, 0, 255))
        img2_bytes = create_dummy_image_bytes(color=(255, 0, 0))

        mock_classify.side_effect = [
            _disaster_cls_result(),
            _non_disaster_cls_result(),
        ]
        mock_groq.return_value = _groq_valid_result()

        images = [
            {"image_index": 1, "filename": "valid_flood.jpg", "image_bytes": img1_bytes},
            {"image_index": 2, "filename": "invalid_selfie.jpg", "image_bytes": img2_bytes},
        ]

        summary = asyncio.run(validate_disaster_images(
            images, location="Punjab", user_description="Flood issue", reported_disaster="Flood"
        ))

        self.assertEqual(summary["total_images"], 2)
        self.assertEqual(summary["accepted_images"], 1)
        self.assertEqual(summary["rejected_images"], 1)
        self.assertTrue(summary["accepted_details"][0]["accepted"])
        self.assertFalse(summary["rejected_details"][0]["accepted"])
        # Groq should only have been called for the disaster image (not the selfie)
        self.assertEqual(mock_groq.call_count, 1)

    def test_11_counts_and_structure_reconcile(self):
        """11. Total count invariant: accepted_images + rejected_images == total_images."""
        img_bytes = create_dummy_image_bytes()
        with patch("services.image_validator.classify_image_locally", return_value=_non_disaster_cls_result()):
            summary = asyncio.run(validate_disaster_images(
                [{"image_index": 1, "filename": "img.jpg", "image_bytes": img_bytes}],
                location="Delhi"
            ))
            self.assertEqual(
                summary["accepted_images"] + summary["rejected_images"],
                summary["total_images"]
            )

    def test_12_failed_validation_never_valid(self):
        """12. Failed validation can never appear as VALID."""
        fallback_res = normalize_analysis({}, image_count=1)
        self.assertFalse(fallback_res["disaster_relevant"])
        self.assertFalse(fallback_res["image_validation"][0]["relevant"])

    # -----------------------------------------------------------------------
    # NEW Groq geo-consistency tests (13-18)
    # -----------------------------------------------------------------------

    @patch("services.image_validator.groq_geo_validate", new_callable=AsyncMock)
    @patch("services.image_validator.classify_image_locally")
    def test_13_groq_flood_matching_location_valid(self, mock_classify, mock_groq):
        """13. Flood image + Ahmedabad location -> Groq returns valid=True -> VALID."""
        img_bytes = create_dummy_image_bytes()
        mock_classify.return_value = _disaster_cls_result()
        mock_groq.return_value = _groq_valid_result("Ahmedabad, Gujarat, India")

        res = asyncio.run(process_single_image(
            {"image_index": 1, "filename": "flood.jpg", "image_bytes": img_bytes},
            location="Ahmedabad, Gujarat, India",
            reported_disaster="Flood",
        ))
        self.assertTrue(res["accepted"])
        self.assertTrue(res["groq_valid"])
        self.assertTrue(res["groq_location_match"])

    @patch("services.image_validator.groq_geo_validate", new_callable=AsyncMock)
    @patch("services.image_validator.classify_image_locally")
    def test_14_groq_flood_wrong_location_invalid(self, mock_classify, mock_groq):
        """14. Flood image + Sahara Desert location -> Groq returns valid=False -> INVALID."""
        img_bytes = create_dummy_image_bytes()
        mock_classify.return_value = _disaster_cls_result()
        mock_groq.return_value = _groq_invalid_location()

        res = asyncio.run(process_single_image(
            {"image_index": 1, "filename": "flood.jpg", "image_bytes": img_bytes},
            location="Sahara Desert",
            reported_disaster="Flood",
        ))
        self.assertFalse(res["accepted"])
        self.assertFalse(res["groq_valid"])
        self.assertFalse(res["groq_location_match"])

    @patch("services.image_validator.groq_geo_validate", new_callable=AsyncMock)
    @patch("services.image_validator.classify_image_locally")
    def test_15_groq_wrong_disaster_type_invalid(self, mock_classify, mock_groq):
        """15. Detected disaster doesn't match reported type -> Groq invalid -> INVALID."""
        img_bytes = create_dummy_image_bytes()
        mock_classify.return_value = _disaster_cls_result(label="forest wildfire", dtype="wildfire")
        mock_groq.return_value = _groq_wrong_type()

        res = asyncio.run(process_single_image(
            {"image_index": 1, "filename": "fire.jpg", "image_bytes": img_bytes},
            location="Ahmedabad, Gujarat",
            reported_disaster="Flood",
        ))
        self.assertFalse(res["accepted"])

    @patch("services.image_validator.groq_geo_validate", new_callable=AsyncMock)
    @patch("services.image_validator.classify_image_locally")
    def test_16_groq_timeout_invalid(self, mock_classify, mock_groq):
        """16. Groq times out -> fail-safe INVALID (never VALID)."""
        img_bytes = create_dummy_image_bytes()
        mock_classify.return_value = _disaster_cls_result()
        mock_groq.return_value = {
            "valid": False,
            "location_match": False,
            "confidence": 0.0,
            "reason": "Groq geo-validation timed out.",
        }

        res = asyncio.run(process_single_image(
            {"image_index": 1, "filename": "flood.jpg", "image_bytes": img_bytes},
            location="Ahmedabad",
            reported_disaster="Flood",
        ))
        self.assertFalse(res["accepted"])
        self.assertFalse(res["groq_valid"])
        self.assertIn("timed out", res["groq_reason"])

    @patch("services.image_validator.groq_geo_validate", new_callable=AsyncMock)
    @patch("services.image_validator.classify_image_locally")
    def test_17_groq_malformed_json_invalid(self, mock_classify, mock_groq):
        """17. Groq returns unparseable JSON -> fail-safe INVALID (never VALID)."""
        img_bytes = create_dummy_image_bytes()
        mock_classify.return_value = _disaster_cls_result()
        mock_groq.return_value = {
            "valid": False,
            "location_match": False,
            "confidence": 0.0,
            "reason": "Groq returned unparseable response: <html>error</html>",
        }

        res = asyncio.run(process_single_image(
            {"image_index": 1, "filename": "flood.jpg", "image_bytes": img_bytes},
            location="Ahmedabad",
            reported_disaster="Flood",
        ))
        self.assertFalse(res["accepted"])
        self.assertFalse(res["groq_valid"])

    @patch("services.image_validator.groq_geo_validate", new_callable=AsyncMock)
    @patch("services.image_validator.classify_image_locally")
    def test_18_mixed_multiple_uploads_independent_groq(self, mock_classify, mock_groq):
        """18. Mixed batch: Image1 VALID (Groq ok), Image2 INVALID (Groq location fail), Image3 INVALID (non-disaster)."""
        img1 = create_dummy_image_bytes(color=(0, 0, 255))
        img2 = create_dummy_image_bytes(color=(255, 128, 0))
        img3 = create_dummy_image_bytes(color=(128, 128, 128))

        mock_classify.side_effect = [
            _disaster_cls_result(),       # img1: disaster detected
            _disaster_cls_result(),       # img2: disaster detected
            _non_disaster_cls_result(),   # img3: non-disaster
        ]
        # Groq only called for img1 and img2 (img3 fails vision gate before Groq)
        mock_groq.side_effect = [
            _groq_valid_result(),         # img1: location ok
            _groq_invalid_location(),     # img2: wrong location
        ]

        images = [
            {"image_index": 1, "filename": "flood1.jpg", "image_bytes": img1},
            {"image_index": 2, "filename": "flood2.jpg", "image_bytes": img2},
            {"image_index": 3, "filename": "selfie.jpg", "image_bytes": img3},
        ]

        summary = asyncio.run(validate_disaster_images(
            images, location="Ahmedabad", user_description="Floods", reported_disaster="Flood"
        ))

        self.assertEqual(summary["total_images"], 3)
        self.assertEqual(summary["accepted_images"], 1)
        self.assertEqual(summary["rejected_images"], 2)
        # Groq called exactly twice (once per disaster image, not for the selfie)
        self.assertEqual(mock_groq.call_count, 2)
        # Verify the accepted image is img1
        self.assertEqual(summary["accepted_details"][0]["image_index"], 1)


class TestLocalGeoValidateUnit(unittest.IsolatedAsyncioTestCase):
    """Unit tests for GeoValidationService and groq_geo_validate() in isolation."""

    @patch("services.geo_validation_service.geocode_nominatim")
    @patch("services.geo_validation_service.fetch_weather_openmeteo")
    @patch("services.geo_validation_service.fetch_elevation_openelevation")
    async def test_01_valid_flood_ahmedabad(self, mock_elevation, mock_weather, mock_geocode):
        """Valid scenario: Flood in Ahmedabad with supporting rainfall."""
        mock_geocode.return_value = {
            "latitude": 23.0225, "longitude": 72.5714,
            "state": "Gujarat", "country": "India",
            "display_name": "Ahmedabad, Gujarat, India"
        }
        mock_weather.return_value = {
            "current_temp": 32.0, "current_rain": 10.0,
            "wind_speed": 12.0, "recent_rain": 25.0
        }
        mock_elevation.return_value = 55.0

        result = await groq_geo_validate("Ahmedabad, Gujarat", "Flood", "flood")
        self.assertTrue(result["valid"])
        self.assertTrue(result["location_match"])
        self.assertIn("significant recent rainfall", result["reason"])

    @patch("services.geo_validation_service.geocode_nominatim")
    @patch("services.geo_validation_service.fetch_weather_openmeteo")
    @patch("services.geo_validation_service.fetch_elevation_openelevation")
    async def test_02_valid_landslide_shimla(self, mock_elevation, mock_weather, mock_geocode):
        """Valid scenario: Landslide in Shimla (mountainous elevation + rain)."""
        mock_geocode.return_value = {
            "latitude": 31.1048, "longitude": 77.1734,
            "state": "Himachal Pradesh", "country": "India",
            "display_name": "Shimla, Himachal Pradesh, India"
        }
        mock_weather.return_value = {
            "current_temp": 18.0, "current_rain": 2.0,
            "wind_speed": 5.0, "recent_rain": 15.0
        }
        mock_elevation.return_value = 2200.0

        result = await groq_geo_validate("Shimla", "Landslide", "landslide")
        self.assertTrue(result["valid"])
        self.assertIn("mountainous/hilly terrain", result["reason"])

    @patch("services.geo_validation_service.geocode_nominatim")
    @patch("services.geo_validation_service.fetch_weather_openmeteo")
    @patch("services.geo_validation_service.fetch_elevation_openelevation")
    async def test_03_valid_cyclone_odisha(self, mock_elevation, mock_weather, mock_geocode):
        """Valid scenario: Cyclone in coastal Odisha."""
        mock_geocode.return_value = {
            "latitude": 20.2961, "longitude": 85.8245,
            "state": "Odisha", "country": "India",
            "display_name": "Puri Coast, Odisha, India"
        }
        mock_weather.return_value = {
            "current_temp": 28.0, "current_rain": 10.0,
            "wind_speed": 50.0, "recent_rain": 40.0
        }
        mock_elevation.return_value = 5.0

        result = await groq_geo_validate("Odisha Coast", "Cyclone", "cyclone")
        self.assertTrue(result["valid"])
        self.assertIn("coastal proximity", result["reason"])

    @patch("services.geo_validation_service.geocode_nominatim")
    @patch("services.geo_validation_service.fetch_weather_openmeteo")
    @patch("services.geo_validation_service.fetch_elevation_openelevation")
    async def test_04_valid_avalanche_ladakh(self, mock_elevation, mock_weather, mock_geocode):
        """Valid scenario: Avalanche in cold, high altitude Ladakh."""
        mock_geocode.return_value = {
            "latitude": 34.1526, "longitude": 77.5770,
            "state": "Ladakh", "country": "India",
            "display_name": "Leh, Ladakh, India"
        }
        mock_weather.return_value = {
            "current_temp": -2.0, "current_rain": 0.0,
            "wind_speed": 15.0, "recent_rain": 0.0
        }
        mock_elevation.return_value = 3500.0

        result = await groq_geo_validate("Ladakh", "Avalanche", "avalanche")
        self.assertTrue(result["valid"])
        self.assertIn("sub-freezing temperatures", result["reason"])

    @patch("services.geo_validation_service.geocode_nominatim")
    @patch("services.geo_validation_service.fetch_weather_openmeteo")
    @patch("services.geo_validation_service.fetch_elevation_openelevation")
    async def test_05_invalid_avalanche_ahmedabad(self, mock_elevation, mock_weather, mock_geocode):
        """Invalid scenario: Avalanche in warm, low elevation Ahmedabad."""
        mock_geocode.return_value = {
            "latitude": 23.0225, "longitude": 72.5714,
            "state": "Gujarat", "country": "India",
            "display_name": "Ahmedabad, Gujarat, India"
        }
        mock_weather.return_value = {
            "current_temp": 32.0, "current_rain": 0.0,
            "wind_speed": 10.0, "recent_rain": 0.0
        }
        mock_elevation.return_value = 55.0

        result = await groq_geo_validate("Ahmedabad", "Avalanche", "avalanche")
        self.assertFalse(result["valid"])
        self.assertIn("too low", result["reason"])

    @patch("services.geo_validation_service.geocode_nominatim")
    @patch("services.geo_validation_service.fetch_weather_openmeteo")
    @patch("services.geo_validation_service.fetch_elevation_openelevation")
    async def test_06_invalid_cyclone_chandigarh(self, mock_elevation, mock_weather, mock_geocode):
        """Invalid scenario: Cyclone in inland Chandigarh."""
        mock_geocode.return_value = {
            "latitude": 30.7333, "longitude": 76.7794,
            "state": "Chandigarh", "country": "India",
            "display_name": "Chandigarh, India"
        }
        mock_weather.return_value = {
            "current_temp": 28.0, "current_rain": 0.0,
            "wind_speed": 5.0, "recent_rain": 0.0
        }
        mock_elevation.return_value = 320.0

        result = await groq_geo_validate("Chandigarh", "Cyclone", "cyclone")
        self.assertFalse(result["valid"])
        self.assertIn("located inland", result["reason"])

    @patch("services.geo_validation_service.geocode_nominatim")
    @patch("services.geo_validation_service.fetch_weather_openmeteo")
    @patch("services.geo_validation_service.fetch_elevation_openelevation")
    async def test_07_invalid_landslide_delhi(self, mock_elevation, mock_weather, mock_geocode):
        """Invalid scenario: Landslide in flat Delhi terrain."""
        mock_geocode.return_value = {
            "latitude": 28.6139, "longitude": 77.2090,
            "state": "Delhi", "country": "India",
            "display_name": "Delhi, India"
        }
        mock_weather.return_value = {
            "current_temp": 25.0, "current_rain": 10.0,
            "wind_speed": 8.0, "recent_rain": 15.0
        }
        mock_elevation.return_value = 200.0

        result = await groq_geo_validate("Delhi", "Landslide", "landslide")
        self.assertFalse(result["valid"])
        self.assertIn("flat", result["reason"])

    @patch("services.geo_validation_service.geocode_nominatim")
    @patch("services.geo_validation_service.fetch_weather_openmeteo")
    @patch("services.geo_validation_service.fetch_elevation_openelevation")
    async def test_08_invalid_wildfire_rain(self, mock_elevation, mock_weather, mock_geocode):
        """Invalid scenario: Wildfire during heavy rain."""
        mock_geocode.return_value = {
            "latitude": 25.0, "longitude": 75.0,
            "state": "Rajasthan", "country": "India",
            "display_name": "Rajasthan, India"
        }
        mock_weather.return_value = {
            "current_temp": 35.0, "current_rain": 15.0,
            "wind_speed": 10.0, "recent_rain": 25.0
        }
        mock_elevation.return_value = 250.0

        result = await groq_geo_validate("Rajasthan", "Wildfire", "wildfire")
        self.assertFalse(result["valid"])
        self.assertIn("heavy rainfall", result["reason"])

    @patch("services.geo_validation_service.geocode_nominatim")
    async def test_09_failure_geocoding(self, mock_geocode):
        """Failure Case: Geocoding failure -> invalid."""
        mock_geocode.return_value = None

        result = await groq_geo_validate("NonExistentCity12345", "Flood", "flood")
        self.assertFalse(result["valid"])
        self.assertIn("Failed to geocode", result["reason"])

    @patch("services.geo_validation_service.geocode_nominatim")
    @patch("services.geo_validation_service.fetch_weather_openmeteo")
    async def test_10_failure_weather_api(self, mock_weather, mock_geocode):
        """Failure Case: Weather API returns None/timeout -> invalid."""
        mock_geocode.return_value = {
            "latitude": 23.0225, "longitude": 72.5714,
            "state": "Gujarat", "country": "India",
            "display_name": "Ahmedabad, Gujarat, India"
        }
        mock_weather.return_value = None

        result = await groq_geo_validate("Ahmedabad", "Flood", "flood")
        self.assertFalse(result["valid"])
        self.assertIn("weather data", result["reason"])

    @patch("services.geo_validation_service.geocode_nominatim")
    @patch("services.geo_validation_service.fetch_weather_openmeteo")
    @patch("services.geo_validation_service.fetch_elevation_openelevation")
    async def test_11_failure_elevation_api(self, mock_elevation, mock_weather, mock_geocode):
        """Failure Case: Elevation API returns None -> invalid."""
        mock_geocode.return_value = {
            "latitude": 23.0225, "longitude": 72.5714,
            "state": "Gujarat", "country": "India",
            "display_name": "Ahmedabad, Gujarat, India"
        }
        mock_weather.return_value = {
            "current_temp": 32.0, "current_rain": 10.0,
            "wind_speed": 12.0, "recent_rain": 25.0
        }
        mock_elevation.return_value = None

        result = await groq_geo_validate("Ahmedabad", "Flood", "flood")
        self.assertFalse(result["valid"])
        self.assertIn("elevation data", result["reason"])


if __name__ == "__main__":
    unittest.main()
