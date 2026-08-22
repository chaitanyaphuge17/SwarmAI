import { useState, useEffect } from "react";
import axios from "axios";

import Navbar from "../components/Navbar";
import DisasterInputPanel from "../components/DisasterInputPanel";
import WelcomeScreen from "../components/WelcomeScreen";
import AnalysisScreen from "../components/AnalysisScreen";
import ResponseView from "../components/ResponseView";

import IncidentQueue from "../components/IncidentQueue";
import AdminCommandCenter from "../components/AdminCommandCenter";
import AdminLogin from "../components/AdminLogin";

import useDashboardData from "../hooks/useDashboardData";
import useGeolocation from "../hooks/useGeolocation";
import {
  getAdminSession,
  logoutAdmin,
} from "../services/adminService";

export default function Dashboard() {
  // ============================================================
  // ADMIN AUTHENTICATION STATE
  // ============================================================

  const [adminSession, setAdminSession] = useState(() =>
    getAdminSession()
  );

  // ============================================================
  // DASHBOARD / BACKEND STATE
  // ============================================================

  const {
    dashboardData,
    loading,
    error,
  } = useDashboardData();

  // ============================================================
  // THEME — listen for Navbar swarmai-theme-change events so
  // pageStyle re-renders whenever the user toggles light/dark.
  // ============================================================

  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem("swarmai-theme");
    return saved === "light" || saved === "dark" ? saved : "light";
  });

  useEffect(() => {
    const handleThemeChange = (e) => {
      const next = e?.detail?.theme;
      if (next === "light" || next === "dark") setTheme(next);
    };
    const handleStorage = (e) => {
      if (e.key !== "swarmai-theme") return;
      if (e.newValue === "light" || e.newValue === "dark") setTheme(e.newValue);
    };
    window.addEventListener("swarmai-theme-change", handleThemeChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("swarmai-theme-change", handleThemeChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // ============================================================
  // GEOLOCATION
  // ============================================================

  const { coords: geoCoords } = useGeolocation({
    auto: true,
  });

  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    if (geoCoords?.lat && geoCoords?.lng) {
      setUserLocation({
        lat: geoCoords.lat,
        lng: geoCoords.lng,
      });
    }
  }, [geoCoords]);

  const handleLocationDetected = (loc) => {
    if (!loc) return;

    setUserLocation({
      lat: loc.lat,
      lng: loc.lng,
    });
  };

  // ============================================================
  // SCREEN & ROUTE STATE
  // ============================================================

  const [currentStep, setCurrentStep] =
    useState("welcome");

  // Possible states:
  // welcome
  // reporting
  // analyzing
  // response
  // admin
  // admin-incident

  const [adminIncident, setAdminIncident] =
    useState(null);

  // ============================================================
  // SYNCHRONIZE ROUTE WITH URL
  // ============================================================

  useEffect(() => {
    const syncRouteFromURL = () => {
      const path =
        window.location.pathname.toLowerCase();

      const hash =
        window.location.hash.toLowerCase();

      if (
        path === "/admin" ||
        path === "/admin/" ||
        path.startsWith("/admin/") ||
        hash === "#/admin" ||
        hash === "#admin"
      ) {
        setCurrentStep("admin");
      }
    };

    syncRouteFromURL();

    window.addEventListener(
      "popstate",
      syncRouteFromURL
    );

    window.addEventListener(
      "hashchange",
      syncRouteFromURL
    );

    return () => {
      window.removeEventListener(
        "popstate",
        syncRouteFromURL
      );

      window.removeEventListener(
        "hashchange",
        syncRouteFromURL
      );
    };
  }, []);

  // ============================================================
  // NAVIGATION
  // ============================================================

  const navigateToHome = () => {
    try {
      window.history.pushState(
        null,
        "",
        "/"
      );
    } catch {
      window.location.hash = "";
    }

    setCurrentStep("welcome");
  };

  const handleLoginSuccess = () => {
    setAdminSession(getAdminSession());
    setCurrentStep("admin");
  };

  const handleLogout = () => {
    logoutAdmin();

    setAdminSession(null);
    setAdminIncident(null);

    try {
      window.history.pushState(
        null,
        "",
        "/"
      );
    } catch {
      window.location.hash = "";
    }

    setCurrentStep("welcome");
  };

  // ============================================================
  // DISASTER STATE
  // ============================================================

  const [
    analyzingDisaster,
    setAnalyzingDisaster,
  ] = useState(false);

  const [
    disasterInput,
    setDisasterInput,
  ] = useState(null);

  const [
    disasterAnalysis,
    setDisasterAnalysis,
  ] = useState(null);

  const [
    apiError,
    setApiError,
  ] = useState(null);

  // Sub-tab within the response step: "analysis" | "map"
  const [
    responseTab,
    setResponseTab,
  ] = useState("analysis");

  // ============================================================
  // ANALYZE DISASTER
  // ============================================================

  const handleDisasterAnalyze = async (input) => {
    console.log(
      "🚨 DISASTER INPUT:",
      input
    );

    // ==========================================================
    // VALIDATE LOCATION
    // ==========================================================

    if (!input?.location?.trim()) {
      setApiError(
        "Please enter the disaster location."
      );

      return;
    }

    // ==========================================================
    // VALIDATE IMAGES
    // ==========================================================

    if (
      !input?.images ||
      input.images.length === 0
    ) {
      setApiError(
        "Please upload or capture at least one disaster image."
      );

      return;
    }

    // ==========================================================
    // RESET STATE
    // ==========================================================

    setDisasterInput(input);
    setAnalyzingDisaster(true);
    setDisasterAnalysis(null);
    setApiError(null);
    setResponseTab("analysis"); // always open analysis tab on new run

    setCurrentStep("analyzing");

    try {
      // ========================================================
      // CREATE FORM DATA
      // ========================================================

      const formData = new FormData();

      formData.append(
        "location",
        input.location.trim()
      );

      formData.append(
        "description",
        input.description?.trim() || ""
      );

      if (input.disasterType) {
        formData.append(
          "disaster_type",
          input.disasterType
        );

        formData.append(
          "disasterType",
          input.disasterType
        );
      }

      // Backend expects:
      // images: list[UploadFile]

      input.images.forEach((image) => {
        formData.append(
          "images",
          image
        );
      });

      console.log(
        "📤 Sending disaster analysis request..."
      );

      console.log(
        "📍 Location:",
        input.location
      );

      console.log(
        "📝 Description:",
        input.description
      );

      console.log(
        "📷 Images:",
        input.images.map((image) => ({
          name: image.name,
          type: image.type,
          size: image.size,
        }))
      );

      // ========================================================
      // BACKEND URL
      // ========================================================

      const baseURL =
        import.meta.env.VITE_BACKEND_URL ||
        "http://127.0.0.1:8000";

      // ========================================================
      // API REQUEST
      // ========================================================

      const response = await axios.post(
        `${baseURL}/disaster/analyze`,
        formData,
        {
          timeout: 180000,
        }
      );

      console.log(
        "✅ DISASTER RESPONSE:",
        response.data
      );

      // ========================================================
      // VALIDATE RESPONSE
      // ========================================================

      if (!response.data?.success) {
        throw new Error(
          response.data?.message ||
          "Backend returned an unsuccessful response."
        );
      }

      // ========================================================
      // STORE RESPONSE
      // ========================================================

      setDisasterAnalysis(
        response.data
      );

      setCurrentStep("response");

      console.log(
        "✅ Disaster analysis completed."
      );
    } catch (err) {
      console.error(
        "❌ Disaster analysis failed:",
        err
      );

      // ========================================================
      // BACKEND ERROR
      // ========================================================

      if (err.response) {
        console.error(
          "Status:",
          err.response.status
        );

        console.error(
          "Response:",
          err.response.data
        );

        const detail =
          err.response.data?.detail;

        if (
          typeof detail === "object" &&
          detail !== null
        ) {
          setApiError(
            detail.message ||
            err.response.data?.message ||
            "The submitted incident could not be processed."
          );
        } else {
          setApiError(
            detail ||
            err.response.data?.message ||
            "Backend failed to analyze the incident."
          );
        }
      }

      // ========================================================
      // CONNECTION ERROR
      // ========================================================

      else if (err.request) {
        setApiError(
          "Unable to connect to the backend. Make sure FastAPI is running on port 8000."
        );
      }

      // ========================================================
      // OTHER ERROR
      // ========================================================

      else {
        setApiError(
          err.message ||
          "An unexpected error occurred."
        );
      }

      // Go back to reporting screen
      setCurrentStep("reporting");
    } finally {
      setAnalyzingDisaster(false);
    }
  };

  // ============================================================
  // RESET
  // ============================================================

  const handleReset = () => {
    setDisasterAnalysis(null);
    setDisasterInput(null);
    setApiError(null);
    setAnalyzingDisaster(false);

    setCurrentStep("reporting");
  };

  // ============================================================
  // GLOBAL PAGE STYLE  (reactive to theme state)
  // ============================================================

  const isDark = theme === "dark";

  const pageStyle = {
    backgroundColor: isDark ? "#020617" : "#F6F8FC",
    color: isDark ? "#f8fafc" : "#111827",
    transition: "background-color 0.3s, color 0.3s",
  };

  // ============================================================
  // ADMIN PORTAL
  // ============================================================

  if (
    currentStep === "admin" ||
    currentStep === "admin-incident"
  ) {
    // ----------------------------------------------------------
    // UNAUTHENTICATED ADMIN
    // ----------------------------------------------------------

    if (!adminSession) {
      return (
        <div
          className="
            min-h-screen
            flex flex-col
            transition-colors
            duration-300
          "
          style={pageStyle}
        >
          <Navbar
            onHome={navigateToHome}
          />

          <main className="flex-1 flex flex-col justify-center">
            <AdminLogin
              onLoginSuccess={
                handleLoginSuccess
              }
              onBackToCitizen={
                navigateToHome
              }
            />
          </main>
        </div>
      );
    }

    // ----------------------------------------------------------
    // AUTHENTICATED ADMIN
    // ----------------------------------------------------------

    return (
      <div
        className="
          min-h-screen
          flex flex-col
          transition-colors
          duration-300
        "
        style={pageStyle}
      >
        <Navbar
          isAdminAuthenticated={true}
          onLogout={handleLogout}
          onHome={navigateToHome}
        />

        <main
          className="
            flex-1
            max-w-6xl
            w-full
            mx-auto
            p-4
            sm:p-8
          "
        >
          {currentStep ===
            "admin-incident" &&
            adminIncident ? (
            <AdminCommandCenter
              incident={adminIncident}
              onBack={() =>
                setCurrentStep("admin")
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={
                    navigateToHome
                  }
                  className="
                    flex
                    items-center
                    gap-2
                    text-xs
                    font-mono
                    uppercase
                    tracking-wider
                    transition
                  "
                  style={{
                    color:
                      "var(--swarm-text-muted)",
                  }}
                >
                  ← Citizen Emergency Portal
                </button>
              </div>

              <IncidentQueue
                onOpenIncident={(
                  incident
                ) => {
                  setAdminIncident(
                    incident
                  );

                  setCurrentStep(
                    "admin-incident"
                  );
                }}
              />
            </div>
          )}
        </main>
      </div>
    );
  }

  // ============================================================
  // WELCOME SCREEN
  // ============================================================

  if (currentStep === "welcome") {
    return (
      <WelcomeScreen
        onBegin={() =>
          setCurrentStep(
            "reporting"
          )
        }
      />
    );
  }

  // ============================================================
  // ANALYZING SCREEN
  // ============================================================

  if (currentStep === "analyzing") {
    return (
      <div
        className="
          min-h-screen
          flex flex-col
          transition-colors
          duration-300
        "
        style={pageStyle}
      >
        <Navbar
          isAdminAuthenticated={
            !!adminSession
          }
          onLogout={handleLogout}
          onHome={navigateToHome}
        />

        <main
          className="
            flex-1
            max-w-5xl
            w-full
            mx-auto
            p-4
            sm:p-8
            flex
            flex-col
            justify-center
          "
        >
          <AnalysisScreen
            location={
              disasterInput?.location ||
              ""
            }
          />
        </main>
      </div>
    );
  }

  // ============================================================
  // RESPONSE SCREEN — tabbed: Analysis Results / Response Map
  // ============================================================

  if (
    currentStep === "response" &&
    disasterAnalysis
  ) {
    // Assemble the mapData object the same way ResponseView did
    const ev = disasterAnalysis.event || {};
    const loc = disasterAnalysis.location || {};
    const respArr = Array.isArray(disasterAnalysis.responses) ? disasterAnalysis.responses : [];

    const extractAgent = (name) => {
      for (const item of respArr) {
        if (!item) continue;
        if (item[name]) return item[name];
        if (item.agent === name) return item;
        if (item.data?.agent === name) return item.data;
      }
      return null;
    };

    const emergencyData = extractAgent("EmergencyAgent");
    const medicalData = extractAgent("MedicalAgent");
    const trafficData = extractAgent("TrafficAgent");
    const resourceData = extractAgent("ResourceAgent");
    const coordinatorData = extractAgent("CoordinatorAgent");
    const routeCoords = Array.isArray(disasterAnalysis.route_coordinates) ? disasterAnalysis.route_coordinates : [];

    const allFacilities = [
      ...(trafficData?.traffic_response?.nearby_facilities || []),
      ...(medicalData?.decision?.nearby_facilities || []),
      ...(medicalData?.nearby_facilities || []),
      ...(resourceData?.decision?.nearby_facilities || []),
      ...(resourceData?.nearby_facilities || []),
      ...(emergencyData?.decision?.nearby_facilities || []),
      ...(emergencyData?.nearby_facilities || []),
      ...(coordinatorData?.decision?.nearby_facilities || []),
      ...(coordinatorData?.nearby_facilities || []),
    ];

    const mapData = {
      event: ev,
      agents: {
        EmergencyAgent: emergencyData,
        MedicalAgent: medicalData,
        TrafficAgent: trafficData,
        ResourceAgent: resourceData,
        CoordinatorAgent: coordinatorData,
      },
      traffic_response: trafficData?.traffic_response,
      resources: resourceData?.decision?.resources ?? {},
      map: {
        latitude: loc.latitude ?? ev.latitude,
        longitude: loc.longitude ?? ev.longitude,
        coordinates: routeCoords,
        facilities: allFacilities,
        affectedArea: ev.disaster_type || ev.disaster || "Disaster",
        location: loc.name || ev.location || "",
      },
      scenario: {
        name: ev.disaster_type || ev.disaster || "Disaster Event",
        location: loc.name || ev.location || "",
      },
      stats: { severity: typeof ev.severity === "number" ? ev.severity : 0 },
    };

    return (
      <div
        className="min-h-screen flex flex-col transition-colors duration-300"
        style={pageStyle}
      >
        <Navbar
          isAdminAuthenticated={!!adminSession}
          onLogout={handleLogout}
          onHome={navigateToHome}
        />

        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8">
          <ResponseView
            data={disasterAnalysis}
            onReset={handleReset}
            userLocation={userLocation}
          />
        </main>
      </div>
    );
  }

  // ============================================================
  // REPORTING SCREEN
  // ============================================================

  if (currentStep === "reporting") {
    return (
      <div
        className="
          min-h-screen
          flex flex-col
          transition-colors
          duration-300
        "
        style={pageStyle}
      >
        <Navbar
          isAdminAuthenticated={
            !!adminSession
          }
          onLogout={handleLogout}
          onHome={navigateToHome}
        />

        <main
          className="
            flex-1
            max-w-5xl
            w-full
            mx-auto
            p-4
            sm:p-8
            flex
            flex-col
            justify-center
          "
        >
          <DisasterInputPanel
            onAnalyze={
              handleDisasterAnalyze
            }
            loading={
              analyzingDisaster
            }
            apiError={apiError}
            initialValues={
              disasterInput
            }
            onLocationDetected={
              handleLocationDetected
            }
          />
        </main>
      </div>
    );
  }

  // ============================================================
  // FALLBACK LOADING
  // ============================================================

  if (loading) {
    return (
      <div
        className="
          min-h-screen
          flex
          items-center
          justify-center
          transition-colors
          duration-300
        "
        style={pageStyle}
      >
        Loading SwarmAI...
      </div>
    );
  }

  // ============================================================
  // CONNECTION ERROR
  // ============================================================

  if (error) {
    return (
      <div
        className="
          min-h-screen
          flex
          flex-col
          items-center
          justify-center
          gap-3
          transition-colors
          duration-300
        "
        style={pageStyle}
      >
        <h2
          className="text-xl font-bold"
          style={{
            color:
              "var(--swarm-primary, #dc2626)",
          }}
        >
          Backend Connection Failed
        </h2>

        <p
          className="text-sm"
          style={{
            color:
              "var(--swarm-text-muted)",
          }}
        >
          {error?.message ||
            "Unable to connect to the backend."}
        </p>

        <button
          type="button"
          onClick={() =>
            setCurrentStep(
              "reporting"
            )
          }
          className="
            rounded-lg
            bg-red-600
            px-4
            py-2
            text-white
            transition
            hover:bg-red-700
          "
        >
          Continue Anyway
        </button>
      </div>
    );
  }

  return null;
}