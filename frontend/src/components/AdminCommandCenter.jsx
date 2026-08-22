/**
 * AdminCommandCenter — top-level admin view for a single incident.
 *
 * Renders three tabs:
 *   1. Incident Details  (reuses existing event data, no AI re-call)
 *   2. Notification Center
 *   3. Delegation Center  (core Round 2 feature)
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  FaShieldAlt,
  FaBell,
  FaTasks,
  FaMapMarkerAlt,
  FaUsers,
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
  if (l === "high")   return <span className="px-2 py-0.5 rounded-lg bg-red-950/60 text-red-300 border border-red-800 text-xs font-semibold">High</span>;
  if (l === "medium") return <span className="px-2 py-0.5 rounded-lg bg-amber-950/60 text-amber-300 border border-amber-800 text-xs font-semibold">Medium</span>;
  return <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold capitalize">{level}</span>;
}

function SeverityBar({ value }) {
  const pct = Math.min(100, (value / 10) * 100);
  const color =
    value >= 8 ? "bg-red-500" : value >= 5 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-bold text-white tabular-nums">
        {value}<span className="text-slate-500 text-xs">/10</span>
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
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <p className="text-xs text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Image Upload & Validation Report
            </p>
            <div className="flex items-center gap-2">
              {incident.total_images > 0 && (
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-mono">
                  {incident.valid_images || (imageUrl ? 1 : 0)} / {incident.total_images || 1} Valid
                </span>
              )}
            </div>
          </div>

          {imageUrl && (
            <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 max-h-80 flex items-center justify-center">
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
              <p className="text-[11px] text-slate-500 font-mono uppercase tracking-wider">Per-Image Verification Log</p>
              <div className="space-y-2">
                {incident.image_validation.map((item, idx) => {
                  const isValid = item.valid === true || item.accepted === true || item.status === "VALID" || item.relevant === true;
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                        isValid
                          ? "bg-emerald-950/30 border-emerald-800/80 text-emerald-200"
                          : "bg-red-950/30 border-red-800/80 text-red-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                          #{item.image_index || idx + 1}
                        </span>
                        <span className="font-medium truncate">{item.filename || `Image ${item.image_index || idx + 1}`}</span>
                        {item.predicted_label && item.predicted_label !== "none" && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700 text-slate-300 font-mono">
                            {item.predicted_label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="italic text-[11px] text-slate-300 max-w-xs truncate">
                          {item.reason}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${
                            isValid
                              ? "bg-emerald-950/80 text-emerald-300 border-emerald-700"
                              : "bg-red-950/80 text-red-300 border-red-700"
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
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-2">User-Reported Description</p>
          <p className="text-sm text-slate-200 italic leading-relaxed">"{incident.description}"</p>
        </div>
      )}

      {/* Overview */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-slate-800">
          <div>
            <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">#{incident.short_id}</p>
            <h3 className="text-xl font-extrabold text-white tracking-tight">{incident.type}</h3>
          </div>
          <span
            className={`ml-auto px-3 py-1 rounded-xl border text-xs font-bold uppercase tracking-wider ${
              incident.severityLabel === "critical"
                ? "bg-red-950/80 text-red-300 border-red-700"
                : incident.severityLabel === "high"
                ? "bg-orange-950/80 text-orange-300 border-orange-700"
                : "bg-amber-950/80 text-amber-300 border-amber-700"
            }`}
          >
            {incident.severityLabel}
          </span>
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <FaMapMarkerAlt className="text-red-500 shrink-0" />
          {incident.location}
        </div>

        {/* Severity Bar */}
        <div>
          <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-2">Severity Rating</p>
          <SeverityBar value={incident.severity || 0} />
        </div>

        {/* Evacuation */}
        {incident.evacuationRequired && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-sm">
            <FaExclamationTriangle className="shrink-0" />
            Immediate evacuation recommended.
          </div>
        )}
      </div>

      {/* AI Summary */}
      {incident.summary && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-2">AI Assessment Summary</p>
          <p className="text-sm text-slate-300 leading-relaxed">{incident.summary}</p>
        </div>
      )}

      {/* Observations, Hazards, Infrastructure */}
      {(observations.length > 0 || hazards.length > 0 || infrastructure.length > 0) && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          {observations.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-2">Observations</p>
              <ul className="space-y-1.5 pl-4 list-disc text-sm text-slate-300">
                {observations.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}

          {hazards.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-2">Detected Hazards</p>
              <div className="flex flex-wrap gap-2">
                {hazards.map((h, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-red-950/50 text-red-300 border border-red-900/60 text-xs font-medium">{h}</span>
                ))}
              </div>
            </div>
          )}

          {infrastructure.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-2">Infrastructure Damage</p>
              <div className="flex flex-wrap gap-2">
                {infrastructure.map((d, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-amber-950/50 text-amber-300 border border-amber-900/60 text-xs font-medium">{d}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Impact Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-xs font-mono uppercase text-slate-500 mb-1.5">
            <FaCar className="text-xs" /> Traffic Impact
          </div>
          <ImpactBadge level={incident.trafficImpact || "low"} />
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-xs font-mono uppercase text-slate-500 mb-1.5">
            <FaHospital className="text-xs" /> Medical Access
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-950/50 border border-red-500/30 shrink-0">
              <FaShieldAlt className="text-white text-lg" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">
                Admin Command Center
              </p>
              <h2 className="text-xl font-extrabold text-white tracking-tight mt-0.5">
                {incident?.type || "Incident"}
              </h2>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <FaMapMarkerAlt className="text-red-500" />
                {incident?.location}
                <span className="text-slate-600">·</span>
                <span className="font-mono text-slate-500">
                  #{incident?.short_id}
                </span>
              </p>
            </div>
          </div>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer shrink-0"
            >
              <FaChevronLeft className="text-xs" />
              Back
            </button>
          )}
        </div>

        {/* Status Row */}
        <div className="mt-4 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-800">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs font-bold">
            <FaCheckCircle className="text-xs" />
            {incident?.status || "validated"}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            Severity: {incident?.severity}/10
          </span>
          {incident?.disaster_type && (
            <span className="text-xs text-slate-500 font-mono">
              · Type: {incident.disaster_type}
            </span>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === id
                ? "bg-red-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Icon className="text-xs" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl min-h-64">
        {activeTab === "workflow"   && <AgentWorkflowPanel incident={incident} />}
        {activeTab === "details"    && <IncidentDetailsTab incident={incident} />}
        {activeTab === "notify"     && <NotificationPanel incident={incident} />}
        {activeTab === "delegation" && <DelegationPanel incident={incident} />}
      </div>
    </motion.div>
  );
}
