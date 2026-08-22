/**
 * AdminCommandCenter — top-level admin view for a single incident.
 *
 * Renders four tabs:
 *   1. Agent Workflow
 *   2. Incident Details
 *   3. Notification Center
 *   4. Delegation Center
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  FaShieldAlt,
  FaBell,
  FaTasks,
  FaMapMarkerAlt,
  FaExclamationTriangle,
  FaCar,
  FaHospital,
  FaChevronLeft,
  FaCheckCircle,
  FaProjectDiagram,
} from "react-icons/fa";
import NotificationPanel from "./NotificationPanel";
import DelegationPanel from "./DelegationPanel";
import AgentWorkflowPanel from "./AgentWorkflowPanel";

const TABS = [
  { id: "workflow",   label: "Agent Workflow",    icon: FaProjectDiagram },
  { id: "details",    label: "Incident Details",  icon: FaShieldAlt },
  { id: "notify",     label: "Notifications",     icon: FaBell },
  { id: "delegation", label: "Delegation Center", icon: FaTasks },
];

function ImpactBadge({ level }) {
  const l = String(level).toLowerCase();
  if (l === "high")   return <span className="px-2 py-0.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-bold">High</span>;
  if (l === "medium") return <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">Medium</span>;
  return <span className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold capitalize">{level}</span>;
}

function SeverityBar({ value }) {
  const pct = Math.min(100, (value / 10) * 100);
  const color =
    value >= 8 ? "bg-red-500" : value >= 5 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-bold text-gray-900 tabular-nums font-mono">
        {value}<span className="text-gray-400 text-xs font-normal">/10</span>
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// INCIDENT DETAILS TAB
// ──────────────────────────────────────────────────────────────
function IncidentDetailsTab({ incident }) {
  if (!incident) return null;

  const observations   = incident.observations || [];
  const hazards        = incident.hazards || [];
  const infrastructure = incident.infrastructure || [];

  const backendBase = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
  const imageUrl = incident.imageUrl
    ? (incident.imageUrl.startsWith("http") ? incident.imageUrl : `${backendBase}${incident.imageUrl}`)
    : null;

  return (
    <div className="space-y-5">
      {/* Image Validation & Evidence Section */}
      {(imageUrl || (incident.image_validation && incident.image_validation.length > 0)) && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <p className="text-xs text-gray-500 font-mono uppercase tracking-wider flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Image Upload & Validation Report
            </p>
            <div className="flex items-center gap-2">
              {incident.total_images > 0 && (
                <span className="px-2.5 py-0.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-[11px] font-mono font-bold">
                  {incident.valid_images || (imageUrl ? 1 : 0)} / {incident.total_images || 1} Valid
                </span>
              )}
            </div>
          </div>

          {imageUrl && (
            <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-white max-h-80 flex items-center justify-center">
              <img
                src={imageUrl}
                alt={`Evidence for ${incident.type}`}
                className="w-full h-full max-h-80 object-cover hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            </div>
          )}

          {/* Per-Image Detailed Validation Breakdown */}
          {Array.isArray(incident.image_validation) && incident.image_validation.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-[11px] text-gray-400 font-mono uppercase tracking-wider font-bold">Per-Image Verification Log</p>
              <div className="space-y-2">
                {incident.image_validation.map((item, idx) => {
                  const isValid = item.valid === true || item.accepted === true || item.status === "VALID" || item.relevant === true;
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                        isValid
                          ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                          : "bg-red-50/60 border-red-200 text-red-900"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-600">
                          #{item.image_index || idx + 1}
                        </span>
                        <span className="font-medium truncate">{item.filename || `Image ${item.image_index || idx + 1}`}</span>
                        {item.predicted_label && item.predicted_label !== "none" && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-600 font-mono">
                            {item.predicted_label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="italic text-[11px] text-gray-500 max-w-xs truncate">
                          {item.reason}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${
                            isValid
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-red-100 text-red-800 border-red-300"
                          }`}
                        >
                          {isValid ? "VALID" : "INVALID"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Description (if provided) */}
      {incident.description && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
          <p className="text-xs text-gray-400 font-mono uppercase tracking-wider mb-2 font-bold">User-Reported Description</p>
          <p className="text-sm text-gray-800 italic leading-relaxed">"{incident.description}"</p>
        </div>
      )}

      {/* Overview */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-gray-200">
          <div>
            <p className="text-xs text-gray-400 font-mono uppercase tracking-wider font-semibold">#{incident.short_id}</p>
            <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">{incident.type}</h3>
          </div>
          <span
            className={`ml-auto px-3 py-1 rounded-xl border text-xs font-bold uppercase tracking-wider ${
              incident.severityLabel === "critical"
                ? "bg-red-50 text-red-700 border-red-200"
                : incident.severityLabel === "high"
                ? "bg-orange-50 text-orange-700 border-orange-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {incident.severityLabel}
          </span>
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
          <FaMapMarkerAlt className="text-red-500 shrink-0" />
          {incident.location}
        </div>

        {/* Severity Bar */}
        <div>
          <p className="text-xs text-gray-400 font-mono uppercase tracking-wider mb-2 font-bold">Severity Rating</p>
          <SeverityBar value={incident.severity || 0} />
        </div>

        {/* Evacuation */}
        {incident.evacuationRequired && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
            <FaExclamationTriangle className="shrink-0 text-red-600" />
            Immediate evacuation recommended.
          </div>
        )}
      </div>

      {/* AI Summary */}
      {incident.summary && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
          <p className="text-xs text-gray-400 font-mono uppercase tracking-wider mb-2 font-bold">AI Assessment Summary</p>
          <p className="text-sm text-gray-700 leading-relaxed">{incident.summary}</p>
        </div>
      )}

      {/* Observations, Hazards, Infrastructure */}
      {(observations.length > 0 || hazards.length > 0 || infrastructure.length > 0) && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
          {observations.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 font-mono uppercase tracking-wider mb-2 font-bold">Observations</p>
              <ul className="space-y-1.5 pl-4 list-disc text-sm text-gray-700">
                {observations.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}

          {hazards.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 font-mono uppercase tracking-wider mb-2 font-bold">Detected Hazards</p>
              <div className="flex flex-wrap gap-2">
                {hazards.map((h, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">{h}</span>
                ))}
              </div>
            </div>
          )}

          {infrastructure.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 font-mono uppercase tracking-wider mb-2 font-bold">Infrastructure Damage</p>
              <div className="flex flex-wrap gap-2">
                {infrastructure.map((d, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">{d}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Impact Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-xs font-mono uppercase text-gray-400 mb-1.5 font-bold">
            <FaCar className="text-xs text-gray-600" /> Traffic Impact
          </div>
          <ImpactBadge level={incident.trafficImpact || "low"} />
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-xs font-mono uppercase text-gray-400 mb-1.5 font-bold">
            <FaHospital className="text-xs text-gray-600" /> Medical Access
          </div>
          <ImpactBadge level={incident.medicalImpact || "low"} />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────

export default function AdminCommandCenter({ incident, onBack }) {
  const [activeTab, setActiveTab] = useState("workflow");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full space-y-5"
    >
      {/* Command Center Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 border border-blue-500 shrink-0">
              <FaShieldAlt className="text-white text-lg" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-mono uppercase tracking-widest font-bold">
                Admin Command Center
              </p>
              <h2 className="text-xl font-extrabold text-gray-900 tracking-tight mt-0.5">
                {incident?.type || "Incident"}
              </h2>
              <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5 font-medium">
                <FaMapMarkerAlt className="text-red-500" />
                {incident?.location}
                <span className="text-gray-300">·</span>
                <span className="font-mono text-gray-400 font-bold">
                  #{incident?.short_id}
                </span>
              </p>
            </div>
          </div>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn-secondary text-xs px-3.5 py-2 shrink-0"
            >
              <FaChevronLeft className="text-xs" />
              Back
            </button>
          )}
        </div>

        {/* Status Row */}
        <div className="mt-4 flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            <FaCheckCircle className="text-xs" />
            {incident?.status || "validated"}
          </span>
          <span className="text-xs text-gray-500 font-mono font-semibold">
            Severity: {incident?.severity}/10
          </span>
          {incident?.disaster_type && (
            <span className="text-xs text-gray-500 font-mono">
              · Type: {incident.disaster_type}
            </span>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1.5 p-1.5 bg-white border border-gray-200 rounded-2xl shadow-xs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === id
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <Icon className="text-xs" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs min-h-64">
        {activeTab === "workflow"   && <AgentWorkflowPanel incident={incident} />}
        {activeTab === "details"    && <IncidentDetailsTab incident={incident} />}
        {activeTab === "notify"     && <NotificationPanel incident={incident} />}
        {activeTab === "delegation" && <DelegationPanel incident={incident} />}
      </div>
    </motion.div>
  );
}
