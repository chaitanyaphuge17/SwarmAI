import { motion } from "framer-motion";
import {
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaUsers,
  FaShieldAlt,
  FaRoute,
  FaFirstAid,
  FaBoxes,
  FaRedo,
  FaCar,
  FaHospital,
  FaCheckCircle,
} from "react-icons/fa";
import MapDashboard from "./MapDashboard";

export default function ResponseView({ data, onReset, userLocation = null }) {

  if (!data || !data.event) {
    return (
      <div className="w-full max-w-4xl mx-auto py-12 text-center text-slate-400">
        <p>No disaster response data available.</p>
        <button
          onClick={onReset}
          className="mt-4 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition"
        >
          Report an Incident
        </button>
      </div>
    );
  }

  const { event, location, responses = [], route_coordinates = [], best_route = [] } = data;

  // Extract agent decisions as user-facing recommendations
  const extractAgentData = (agentName) => {
    if (!Array.isArray(responses)) return null;
    for (const item of responses) {
      if (!item) continue;
      if (item[agentName]) return item[agentName];
      if (item.agent === agentName) return item;
      if (item.data && item.data.agent === agentName) return item.data;
    }
    return null;
  };

  const emergencyData = extractAgentData("EmergencyAgent");
  const trafficData = extractAgentData("TrafficAgent");
  const medicalData = extractAgentData("MedicalAgent");
  const resourceData = extractAgentData("ResourceAgent");

  const formatDecision = (decision) => {
    if (decision === null || decision === undefined) return "";
    if (typeof decision === "string" || typeof decision === "number") {
      return String(decision);
    }
    if (typeof decision === "object" && decision.recommendation) {
      return String(decision.recommendation);
    }
    return JSON.stringify(decision);
  };

  const emergencyRecommendation = formatDecision(emergencyData?.decision);
  const medicalRecommendation = formatDecision(medicalData?.decision);
  const resourceRecommendation = formatDecision(resourceData?.decision);
  const routeStatus = trafficData?.traffic_response?.route_status || "Standard Emergency Route";

  const disasterType = event.disaster_type || event.disaster || "Disaster Event";
  const locationName = location?.name || event.location || "Incident Location";
  const severity = typeof event.severity === "number" ? event.severity : null;
  const victimEstimate = event.victim_estimate !== null && event.victim_estimate !== undefined
    ? event.victim_estimate
    : (typeof event.victims === "number" ? event.victims : null);

  const evacuationRequired = Boolean(event.evacuation_required);
  const trafficImpact = event.traffic_impact || "low";
  const medicalAccessImpact = event.medical_access_impact || "low";

  const observations = Array.isArray(event.observations) ? event.observations : [];
  const hazards = Array.isArray(event.hazards) ? event.hazards : [];
  const infrastructureDamage = Array.isArray(event.infrastructure_damage) ? event.infrastructure_damage : [];
  const summary = event.summary || "";

  // Prepare map data structure expected by MapDashboard
  const mapData = {
    event,
    agents: {
      TrafficAgent: trafficData,
    },
    traffic_response: trafficData?.traffic_response,
    resources: resourceData?.decision?.resources ?? {},
    map: {
      latitude: location?.latitude ?? event.latitude,
      longitude: location?.longitude ?? event.longitude,
      coordinates: route_coordinates,
      facilities: trafficData?.traffic_response?.nearby_facilities ?? [],
      affectedArea: disasterType,
      location: locationName,
    },
    scenario: {
      name: disasterType,
      location: locationName,
    },
    stats: {
      severity: severity ?? 0,
    },
  };

  const getImpactBadgeClass = (level) => {
    const l = String(level).toLowerCase();
    if (l === "high") return "bg-red-950/60 text-red-300 border-red-800";
    if (l === "medium") return "bg-amber-950/60 text-amber-300 border-amber-800";
    return "bg-slate-800 text-slate-300 border-slate-700";
  };

  const getSeverityBadgeClass = (score) => {
    if (!score) return "bg-slate-800 text-slate-300 border-slate-700";
    if (score >= 8) return "bg-red-950/80 text-red-300 border-red-700";
    if (score >= 5) return "bg-amber-950/80 text-amber-300 border-amber-700";
    return "bg-emerald-950/80 text-emerald-300 border-emerald-700";
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-12">
      {/* 1. INCIDENT OVERVIEW HEADER */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Actionable Decision Intelligence</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
              {disasterType}
            </h1>

            <p className="text-sm text-slate-400 flex items-center gap-1.5 mt-2">
              <FaMapMarkerAlt className="text-red-500 shrink-0" />
              <span>{locationName}</span>
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Severity Rating */}
            {severity !== null && (
              <div
                className={`px-4 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider ${getSeverityBadgeClass(
                  severity
                )}`}
              >
                <p className="text-[10px] opacity-75">Severity Rating</p>
                <p className="text-base font-extrabold mt-0.5">{severity} / 10</p>
              </div>
            )}

            {/* Traffic Impact */}
            <div className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold">
              <p className="text-[10px] text-slate-400 font-normal uppercase tracking-wider">
                Traffic Impact
              </p>
              <p className="text-base font-extrabold text-white uppercase mt-0.5">
                {trafficImpact}
              </p>
            </div>
          </div>
        </div>

        {/* Evacuation Directive Banner */}
        <div className="mt-6 pt-6 border-t border-slate-800">
          {evacuationRequired ? (
            <div className="p-4 rounded-xl bg-red-950/50 border border-red-700/80 text-red-200 flex items-start sm:items-center gap-3.5">
              <FaExclamationTriangle className="text-xl text-red-400 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="text-xs uppercase font-extrabold tracking-wider bg-red-800 text-white px-2 py-0.5 rounded mr-2">
                  Action Required
                </span>
                <span className="text-sm font-semibold text-red-100">
                  Immediate evacuation recommended for affected sectors.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-3">
              <FaCheckCircle className="text-emerald-400 text-lg shrink-0" />
              <span className="text-sm">
                Evacuation is not currently mandated. Maintain situational awareness and monitor local directives.
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* 2. SITUATION ASSESSMENT & RECOMMENDED ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SITUATION ASSESSMENT */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <FaShieldAlt className="text-red-500" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Situation Assessment
            </h2>
          </div>

          {/* Visual AI Summary */}
          {summary && (
            <div>
              <p className="text-xs uppercase font-mono tracking-wider text-slate-400 mb-1">
                Visual Assessment Summary
              </p>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
                {summary}
              </p>
            </div>
          )}

          {/* Observations */}
          {observations.length > 0 && (
            <div>
              <p className="text-xs uppercase font-mono tracking-wider text-slate-400 mb-2">
                Identified Observations
              </p>
              <ul className="space-y-1.5 text-sm text-slate-300 pl-4 list-disc">
                {observations.map((item, idx) => (
                  <li key={idx} className="leading-snug">{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Hazards & Damage */}
          {(hazards.length > 0 || infrastructureDamage.length > 0) && (
            <div className="space-y-3 pt-2">
              {hazards.length > 0 && (
                <div>
                  <p className="text-xs uppercase font-mono tracking-wider text-slate-400 mb-1.5">
                    Detected Hazards
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {hazards.map((hazard, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-red-950/50 text-red-300 border border-red-900/60 text-xs font-medium"
                      >
                        {hazard}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {infrastructureDamage.length > 0 && (
                <div>
                  <p className="text-xs uppercase font-mono tracking-wider text-slate-400 mb-1.5">
                    Infrastructure Damage
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {infrastructureDamage.map((damage, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-amber-950/50 text-amber-300 border border-amber-900/60 text-xs font-medium"
                      >
                        {damage}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Impact Indicators */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
            <div className={`p-3 rounded-xl border ${getImpactBadgeClass(trafficImpact)}`}>
              <div className="flex items-center gap-1.5 text-xs font-mono uppercase">
                <FaCar className="text-xs" />
                <span>Traffic Impact</span>
              </div>
              <p className="text-sm font-bold capitalize mt-1">{trafficImpact}</p>
            </div>

            <div className={`p-3 rounded-xl border ${getImpactBadgeClass(medicalAccessImpact)}`}>
              <div className="flex items-center gap-1.5 text-xs font-mono uppercase">
                <FaHospital className="text-xs" />
                <span>Medical Access Impact</span>
              </div>
              <p className="text-sm font-bold capitalize mt-1">{medicalAccessImpact}</p>
            </div>
          </div>
        </motion.div>

        {/* RECOMMENDED RESPONSE DIRECTIVES */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <FaShieldAlt className="text-red-500" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Recommended Response
              </h2>
            </div>

            <div className="space-y-4 mt-4">
              {/* Emergency Recommendation */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-400 uppercase tracking-wider">
                  <FaExclamationTriangle />
                  <span>Recommended Emergency Response</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-medium pt-1">
                  {emergencyRecommendation || "Maintain standard emergency monitoring protocols."}
                </p>
              </div>

              {/* Medical Recommendation */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                  <FaFirstAid />
                  <span>Recommended Medical Response</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-medium pt-1">
                  {medicalRecommendation || "Standard medical triage and on-site aid readiness."}
                </p>
              </div>

              {/* Resource Recommendation */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  <FaBoxes />
                  <span>Recommended Resource Allocation</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-medium pt-1">
                  {resourceRecommendation || "Maintain regional equipment and resource readiness."}
                </p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 font-mono italic pt-2">
            * All guidance represents automated intelligence recommendations for decision-makers.
          </p>
        </motion.div>
      </div>

      {/* 3. EMERGENCY ROUTE & TRANSIT GUIDANCE */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FaRoute className="text-cyan-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Emergency Transit Guidance
            </h2>
          </div>

          <span className="px-3 py-1 rounded-lg bg-cyan-950/60 border border-cyan-800 text-cyan-300 text-xs font-semibold self-start sm:self-auto">
            {routeStatus}
          </span>
        </div>

        {Array.isArray(best_route) && best_route.length > 0 && (
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <p className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
              Designated Route Waypoint Sectors
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-200">
              {best_route.map((sector, index) => (
                <span key={index} className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 text-xs font-mono">
                    {sector}
                  </span>
                  {index < best_route.length - 1 && (
                    <span className="text-slate-600">→</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* 4. INTERACTIVE MAP */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="rounded-2xl overflow-hidden shadow-2xl border border-slate-800"
      >
        <MapDashboard data={mapData} userLocation={userLocation} />
      </motion.div>

      {/* 5. RESET / REPORT ANOTHER INCIDENT ACTION */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="flex flex-col sm:flex-row justify-center gap-3 pt-4"
      >
        <button
          type="button"
          onClick={onReset}
          className="px-8 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-sm tracking-wide transition-all shadow-lg flex items-center gap-2.5 border border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          <FaRedo className="text-xs text-slate-400" />
          <span>Report Another Incident</span>
        </button>
      </motion.div>
    </div>
  );
}
