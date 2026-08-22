import { useState, useEffect, useCallback } from "react";

// ============================================================
// useGeolocation
// ------------------------------------------------------------
// Wraps the browser Geolocation API.
// Returns { coords, loading, error, refetch }
//
// coords: { lat: number, lng: number, accuracy: number } | null
// loading: boolean
// error:   string | null
// refetch: () => void  — trigger another position fetch
// ============================================================

export default function useGeolocation({ auto = true } = {}) {

  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPosition = useCallback(() => {
    if (!navigator?.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLoading(false);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Location access denied. Please enter location manually.");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Location information is currently unavailable.");
            break;
          case err.TIMEOUT:
            setError("Location request timed out. Please try again.");
            break;
          default:
            setError("An unknown error occurred while retrieving location.");
        }
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, []);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (auto) {
      fetchPosition();
    }
  }, [auto, fetchPosition]);

  return {
    coords,
    loading,
    error,
    refetch: fetchPosition,
  };
}
