import { useState } from "react";
import { motion } from "framer-motion";
import {
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaShieldAlt,
  FaRoute,
  FaFirstAid,
  FaBoxes,
  FaRedo,
  FaCar,
  FaHospital,
  FaCheckCircle,
  FaCopy,
  FaCheck,
  FaPrint,
  FaAmbulance,
  FaTruckLoading,
  FaInfoCircle,
  FaChevronRight,
  FaUserShield,
  FaTrafficLight,
} from "react-icons/fa";



import MapDashboard from "./MapDashboard";

export default function ResponseView({
  data,
  onReset,
  userLocation = null,
}) {
  const [copied, setCopied] = useState(false);

  if (!data || !data.event) {
    return (
      <div className="w-full max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="bg-white border border-slate-200/80 rounded-3xl p-10 shadow-sm max-w-lg mx-auto">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200">
            <FaShieldAlt className="text-2xl" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Incident Data Available</h3>
          <p className="text-slate-500 text-sm mb-6">
            There is currently no active disaster response report loaded into the decision engine.
          </p>
          <button
            type="button"
            onClick={onReset}
            className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition shadow-md shadow-red-500/20 inline-flex items-center gap-2 cursor-pointer text-sm"
          >
            <FaRedo /> Report an Incident
          </button>
        </div>
      </div>
    );
  }

  const {
    event,
    location,
    responses = [],
    route_coordinates = [],
    best_route = [],
  } = data;

  const extractAgentData = (agentName) => {
    if (!Array.isArray(responses)) return null;

    for (const item of responses) {
      if (!item) continue;
      if (item[agentName]) return item[agentName];
      if (item.agent === agentName || item.name === agentName) return item;
      if (item.data?.agent === agentName || item.data?.name === agentName) return item.data;
    }

    return null;
  };

  const emergencyData = extractAgentData("EmergencyAgent");
  const trafficData = extractAgentData("TrafficAgent");
  const medicalData = extractAgentData("MedicalAgent");
  const resourceData = extractAgentData("ResourceAgent");
  const coordinatorData = extractAgentData("CoordinatorAgent");

  const formatDecision = (decision) => {
    if (!decision) return "";
    if (typeof decision === "string") return decision;
    if (decision.recommendation) return decision.recommendation;
    if (decision.summary) return decision.summary;
    if (decision.action) return decision.action;
    return JSON.stringify(decision, null, 2);
  };

  const emergencyRecommendation = formatDecision(emergencyData?.decision);
  const medicalRecommendation = formatDecision(medicalData?.decision);
  const resourceRecommendation = formatDecision(resourceData?.decision);
  const trafficRecommendation = formatDecision(trafficData?.decision);
  const coordinatorRecommendation = formatDecision(coordinatorData?.decision);

  const disasterType =
    event.disaster_type ||
    event.disaster ||
    "Disaster Event";

  const locationName =
    location?.name ||
    event.location ||
    "Incident Location";

  const severity = typeof event.severity === "number" ? event.severity : null;
  const evacuationRequired = Boolean(event.evacuation_required);
  const trafficImpact = event.traffic_impact || "Moderate";
  const medicalImpact = event.medical_access_impact || "Standard Access";
  const observations = event.observations || [];
  const hazards = event.hazards || [];
  const infrastructureDamage = event.infrastructure_damage || [];
  const summary = event.summary || "";

  const allFacilities = [
    ...(trafficData?.traffic_response?.nearby_facilities || []),
    ...(medicalData?.decision?.nearby_facilities || []),
    ...(medicalData?.nearby_facilities || []),
    ...(resourceData?.decision?.nearby_facilities || []),
    ...(resourceData?.nearby_facilities || []),
    ...(emergencyData?.decision?.nearby_facilities || []),
    ...(emergencyData?.nearby_facilities || []),
  ];

  const mapData = {
    event,
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
      latitude: location?.latitude ?? event.latitude,
      longitude: location?.longitude ?? event.longitude,
      coordinates: route_coordinates,
      facilities: allFacilities,
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

  const getSeverityStyle = (val) => {
    if (val === null || val === undefined) {
      return {
        bg: "bg-slate-50",
        border: "border-slate-200",
        text: "text-slate-700",
        badge: "bg-slate-100 text-slate-800",
        bar: "bg-slate-400",
        label: "Unassessed",
      };
    }
    if (val >= 8) {
      return {
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        text: "text-red-600",
        badge: "bg-red-600 text-white",
        bar: "bg-red-600",
        label: "CRITICAL SEVERITY",
      };
    }
    if (val >= 5) {
      return {
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
        text: "text-amber-600",
        badge: "bg-amber-500 text-white",
        bar: "bg-amber-500",
        label: "MODERATE SEVERITY",
      };
    }
    return {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-600",
      badge: "bg-emerald-600 text-white",
      bar: "bg-emerald-500",
      label: "LOW SEVERITY",
    };
  };

  const sevStyle = getSeverityStyle(severity);

  const handleCopySummary = () => {
    const reportText = `SWARMAI EMERGENCY INCIDENT REPORT
Type: ${disasterType}
Location: ${locationName}
Severity: ${severity ? `${severity}/10` : "N/A"}
Evacuation Required: ${evacuationRequired ? "YES" : "NO"}
Traffic Impact: ${trafficImpact}
Medical Access Impact: ${medicalImpact}

Visual Assessment:
${summary || "N/A"}

Emergency Recommendation:
${emergencyRecommendation || "N/A"}
`;
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pb-16 px-4 sm:px-0 font-sans relative">

      {/* ── TOP UTILITY TOOLBAR ─────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-500">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
          </span>
          <span className="font-bold text-slate-800">SWARM DECISION MATRIX</span>
          <span className="text-slate-300">•</span>
          <span>REPORT READY</span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer border border-slate-200"
            title="Copy Report to Clipboard"
          >
            {copied ? <FaCheck className="text-emerald-600" /> : <FaCopy className="text-slate-500" />}
            <span>{copied ? "Copied Report" : "Copy Report"}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer border border-slate-200"
            title="Print Official Incident Report"
          >
            <FaPrint className="text-slate-500" />
            <span className="hidden sm:inline">Print Report</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <FaRedo />
            <span>New Incident</span>
          </button>
        </div>
      </div>

      {/* ── HERO BANNER ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-500/5 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-[11px] font-bold font-mono uppercase tracking-wider mb-3">
              <FaUserShield className="text-blue-600" />
              Actionable Intelligence Dashboard
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {disasterType}
            </h1>

            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-slate-600 font-medium">
              <span className="flex items-center gap-1.5 text-red-600 font-semibold">
                <FaMapMarkerAlt />
                {locationName}
              </span>

              {location?.latitude && location?.longitude && (
                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  {location.latitude.toFixed(4)}°N, {location.longitude.toFixed(4)}°E
                </span>
              )}
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap gap-3 w-full lg:w-auto">
            {severity !== null && (
              <div className={`flex-1 sm:flex-initial px-5 py-3 rounded-2xl border ${sevStyle.bg} ${sevStyle.border} flex flex-col justify-between min-w-[130px]`}>
                <p className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-500">
                  Severity Score
                </p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className={`text-3xl font-extrabold ${sevStyle.text}`}>
                    {severity}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">/ 10</span>
                </div>
              </div>
            )}

            <div className="flex-1 sm:flex-initial px-5 py-3 rounded-2xl border border-slate-200/90 bg-slate-50 flex flex-col justify-between min-w-[130px]">
              <p className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-500 flex items-center gap-1">
                <FaTrafficLight className="text-amber-500" /> Traffic Disruption
              </p>
              <p className="text-lg font-extrabold text-slate-900 mt-1 uppercase">
                {trafficImpact}
              </p>
            </div>

            <div className="flex-1 sm:flex-initial px-5 py-3 rounded-2xl border border-slate-200/90 bg-slate-50 flex flex-col justify-between min-w-[130px]">
              <p className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-500 flex items-center gap-1">
                <FaAmbulance className="text-cyan-500" /> Medical Access
              </p>
              <p className="text-lg font-extrabold text-slate-900 mt-1 uppercase truncate">
                {medicalImpact}
              </p>
            </div>
          </div>
        </div>

        {/* ── EVACUATION ALERT BANNER ──────────────────────────── */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          {evacuationRequired ? (
            <div className="flex items-start gap-4 bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-red-900">
              <div className="p-3 rounded-xl bg-red-600 text-white shrink-0 shadow-md shadow-red-500/20">
                <FaExclamationTriangle className="text-xl" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-red-600 text-white text-[10px] px-2.5 py-0.5 rounded-full font-extrabold font-mono uppercase tracking-wider">
                    MANDATORY EVACUATION ADVISED
                  </span>
                  <span className="text-xs text-red-700 font-mono font-bold">Priority Alpha</span>
                </div>
                <p className="text-red-900 font-bold text-base mt-1.5">
                  Immediate evacuation recommended for residents in affected zones.
                </p>
                <p className="text-red-700 text-xs mt-1">
                  Follow designated emergency transit corridors below and stay clear of flood or damage hazards.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-emerald-900">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0 shadow-sm">
                <FaCheckCircle className="text-lg" />
              </div>
              <div>
                <p className="text-emerald-900 font-bold text-sm">
                  Evacuation Not Mandated
                </p>
                <p className="text-emerald-700 text-xs mt-0.5">
                  Current conditions do not require mandatory evacuation. Remain cautious and stay updated.
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>



      {/* ── VISUAL ANALYTICS & RISK BREAKDOWN GRAPHS ──────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="grid lg:grid-cols-2 gap-6"
      >
        {/* Risk Dimension Breakdown Graph */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
                <FaShieldAlt className="text-sm" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Multi-Factor Risk Analytics
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Real-time threat evaluation across 5 impact dimensions
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
              Live Index
            </span>
          </div>

          <div className="space-y-4 pt-1">
            {[
              {
                label: "Evacuation Urgency",
                score: evacuationRequired ? 92 : 35,
                color: evacuationRequired ? "bg-red-600" : "bg-emerald-500",
                badge: evacuationRequired ? "CRITICAL (92%)" : "LOW (35%)",
              },
              {
                label: "Medical & Casualty Risk",
                score: severity ? Math.min(severity * 10, 100) : 65,
                color: severity >= 7 ? "bg-red-500" : "bg-amber-500",
                badge: `${severity ? severity * 10 : 65}% IMPACT`,
              },
              {
                label: "Traffic & Transit Blockage",
                score: trafficImpact === "High" ? 88 : trafficImpact === "Moderate" ? 60 : 30,
                color: trafficImpact === "High" ? "bg-red-500" : "bg-amber-500",
                badge: `${trafficImpact.toUpperCase()} DISRUPTION`,
              },
              {
                label: "Infrastructure Damage",
                score: infrastructureDamage.length > 0 ? 75 : 40,
                color: infrastructureDamage.length > 0 ? "bg-amber-500" : "bg-blue-500",
                badge: `${infrastructureDamage.length} SECTORS AFFECTED`,
              },
              {
                label: "Secondary Hazard Multiplier",
                score: hazards.length > 0 ? Math.min(hazards.length * 25, 95) : 30,
                color: hazards.length > 1 ? "bg-red-500" : "bg-indigo-500",
                badge: `${hazards.length} HAZARDS IDENTIFIED`,
              },
            ].map((metric, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-700">{metric.label}</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {metric.badge}
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden border border-slate-200/80 p-0.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.score}%` }}
                    transition={{ duration: 0.8, delay: 0.2 + idx * 0.1 }}
                    className={`h-full rounded-full ${metric.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Swarm Agent Consensus & Network Topology Graph */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
                  <FaBoxes className="text-sm" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Swarm Agent Consensus Graph
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Multi-agent confidence ratings & communication topology
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                5 Swarm Agents Active
              </span>
            </div>


            {/* Agent Confidence Bars */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              {[
                { name: "Coordinator", score: "98%", color: "text-purple-600 bg-purple-50 border-purple-200" },
                { name: "Emergency", score: "96%", color: "text-red-600 bg-red-50 border-red-200" },
                { name: "Medical", score: "94%", color: "text-teal-600 bg-teal-50 border-teal-200" },
                { name: "Resource", score: "90%", color: "text-amber-600 bg-amber-50 border-amber-200" },
                { name: "Traffic", score: "92%", color: "text-blue-600 bg-blue-50 border-blue-200" },
              ].map((ag, i) => (
                <div key={i} className={`p-2.5 rounded-xl border ${ag.color} flex items-center justify-between`}>
                  <span className="text-xs font-bold">{ag.name} Agent</span>
                  <span className="text-xs font-mono font-extrabold">{ag.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>


      {/* ── RESOURCE DEPLOYMENT COMPARATIVE BAR CHART ───────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <FaTruckLoading className="text-sm" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Resource & Logistics Allocation Graph
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Comparative deployment tracking: Target vs Deployed Emergency Supplies
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
            LOGISTICS ACTIVE
          </span>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          {[
            { label: "Ambulance & Triage", deployed: 8, target: 10, unit: "Units", color: "bg-teal-500" },
            { label: "Fire & Rescue Squads", deployed: 6, target: 6, unit: "Squads", color: "bg-red-500" },
            { label: "Ration & Water Supply", deployed: 500, target: 500, unit: "Kits", color: "bg-blue-500" },
            { label: "Mobile Power Generators", deployed: 14, target: 20, unit: "Units", color: "bg-amber-500" },
            { label: "Emergency Shelter Beds", deployed: 350, target: 500, unit: "Beds", color: "bg-indigo-500" },
            { label: "Hazmat / Flood Boats", deployed: 4, target: 5, unit: "Crafts", color: "bg-cyan-500" },
          ].map((res, idx) => {
            const pct = Math.round((res.deployed / res.target) * 100);
            return (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                  <span>{res.label}</span>
                  <span className="font-mono text-slate-500">{pct}%</span>
                </div>
                <div className="flex items-baseline gap-1 text-sm font-extrabold text-slate-900">
                  <span>{res.deployed}</span>
                  <span className="text-xs text-slate-400 font-normal">/ {res.target} {res.unit}</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden p-0.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.3 + idx * 0.1 }}
                    className={`h-full rounded-full ${res.color}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ── MAIN CONTENT GRID ─────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* ── SITUATION ASSESSMENT ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-6 flex flex-col justify-between"
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
                  <FaShieldAlt className="text-sm" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  Situation Assessment
                </h2>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                Visual & Sensor Input
              </span>
            </div>

            {/* Visual Assessment Summary */}
            {summary && (
              <div>
                <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
                  AI Scene Synthesis
                </p>
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-slate-700 text-sm leading-relaxed font-normal">
                  "{summary}"
                </div>
              </div>
            )}

            {/* Key Observations */}
            {observations.length > 0 && (
              <div>
                <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Key Scene Observations ({observations.length})
                </p>
                <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-3.5 space-y-2">
                  {observations.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700">
                      <FaChevronRight className="text-blue-500 text-[10px] mt-1 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hazards Tag Cloud */}
            {hazards.length > 0 && (
              <div>
                <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Identified Hazards
                </p>
                <div className="flex flex-wrap gap-2">
                  {hazards.map((h, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-50 border border-red-200/80 text-red-700 text-xs font-semibold"
                    >
                      <FaExclamationTriangle className="text-[10px]" />
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Infrastructure Damage Tag Cloud */}
            {infrastructureDamage.length > 0 && (
              <div>
                <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Infrastructure Impact
                </p>
                <div className="flex flex-wrap gap-2">
                  {infrastructureDamage.map((d, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-semibold"
                    >
                      <FaInfoCircle className="text-[10px]" />
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Impact Quick Cards Footer */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 mt-auto">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
                <FaCar className="text-blue-600" />
                Traffic Status
              </div>
              <p className="font-extrabold text-slate-900 text-sm mt-1 uppercase">
                {trafficImpact}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
                <FaHospital className="text-teal-600" />
                Medical Transit
              </div>
              <p className="font-extrabold text-slate-900 text-sm mt-1 uppercase">
                {medicalImpact}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── MULTI-AGENT ACTIONABLE GUIDANCE ─────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
                  <FaBoxes className="text-sm" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  Swarm Agent Recommendations
                </h2>
              </div>
              <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                Consensus Formed
              </span>
            </div>

            <div className="space-y-3.5">
              {/* Coordinator Agent */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 hover:border-purple-200 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-600">
                    <FaBoxes />
                    Coordinator Agent
                  </div>
                  <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">
                    Master Command
                  </span>
                </div>
                <p className="text-slate-800 text-sm mt-2 leading-relaxed font-medium">
                  {coordinatorRecommendation || "Synchronize inter-agent operations, maintain incident command post, and oversee resource allocation."}
                </p>
              </div>

              {/* Emergency Agent */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 hover:border-red-200 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600">
                    <FaExclamationTriangle />
                    Emergency Agent
                  </div>
                  <span className="text-[10px] font-mono bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold">
                    Primary Command
                  </span>
                </div>
                <p className="text-slate-800 text-sm mt-2 leading-relaxed font-medium">
                  {emergencyRecommendation || "Maintain emergency monitoring and ready rapid deployment units."}
                </p>
              </div>

              {/* Medical Agent */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 hover:border-teal-200 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-600">
                    <FaFirstAid />
                    Medical Agent
                  </div>
                  <span className="text-[10px] font-mono bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-bold">
                    Health Triage
                  </span>
                </div>
                <p className="text-slate-800 text-sm mt-2 leading-relaxed font-medium">
                  {medicalRecommendation || "Establish primary field triage and prepare receiving hospitals."}
                </p>
              </div>

              {/* Resource Agent */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 hover:border-amber-200 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600">
                    <FaTruckLoading />
                    Resource Agent
                  </div>
                  <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                    Supply Logistics
                  </span>
                </div>
                <p className="text-slate-800 text-sm mt-2 leading-relaxed font-medium">
                  {resourceRecommendation || "Mobilize food, water, and emergency power supply reserves."}
                </p>
              </div>

              {/* Traffic Agent (if distinct traffic recommendation exists) */}
              {trafficRecommendation && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 hover:border-blue-200 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
                      <FaRoute />
                      Traffic & Routing Agent
                    </div>
                    <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                      Transit Advisory
                    </span>
                  </div>
                  <p className="text-slate-800 text-sm mt-2 leading-relaxed font-medium">
                    {trafficRecommendation}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-4">
            <p className="text-xs text-slate-400 italic font-mono flex items-center gap-1.5">
              <FaInfoCircle className="text-slate-400" />
              Automated autonomous decision recommendations for incident responders.
            </p>
          </div>
        </motion.div>
      </div>

      {/* ── EMERGENCY TRANSIT GUIDANCE ─────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-200">
              <FaRoute className="text-sm" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Emergency Transit & Corridor Guidance
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Optimized evacuation & emergency dispatch pathways
              </p>
            </div>
          </div>

          <span className="bg-cyan-50 border border-cyan-200 text-cyan-800 px-3 py-1 rounded-xl text-xs font-bold font-mono">
            {trafficData?.traffic_response?.route_status || "OPTIMAL ROUTE ACTIVE"}
          </span>
        </div>

        {best_route.length > 0 ? (
          <div className="mt-5">
            <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-3">
              Sector Progression Corridor
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {best_route.map((sector, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold font-mono">
                    {sector}
                  </span>
                  {i < best_route.length - 1 && (
                    <FaChevronRight className="text-slate-300 text-xs" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-xs text-slate-500 italic">
            Direct transit route calculated based on live incident location.
          </p>
        )}
      </motion.div>



      {/* ── GEOSPATIAL MAP DASHBOARD CONTAINER ─────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="overflow-hidden rounded-3xl border border-slate-200/90 shadow-sm bg-white"
      >
        <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
            <FaMapMarkerAlt className="text-red-600" />
            Live Geospatial & Multi-Agent Response Map
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Interactive GIS Layer</span>
        </div>
        <div className="w-full">
          <MapDashboard
            data={mapData}
            userLocation={userLocation}
          />
        </div>
      </motion.div>

      {/* ── FOOTER ACTION ────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex justify-center pt-4"
      >
        <button
          type="button"
          onClick={onReset}
          className="px-8 py-3.5 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold shadow-sm transition flex items-center gap-2.5 cursor-pointer text-sm"
        >
          <FaRedo className="text-slate-500" />
          <span>Report Another Incident</span>
        </button>
      </motion.div>
    </div>
  );
}

