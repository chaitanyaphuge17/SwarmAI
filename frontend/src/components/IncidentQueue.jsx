/**
 * IncidentQueue — displays validated incidents from MongoDB
 * as a card list for the Admin Dashboard entry point.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaUsers,
  FaFolderOpen,
  FaSync,
} from "react-icons/fa";
import { getIncidents } from "../services/adminService";

function SeverityBadge({ label }) {
  const cfg = {
    critical: "bg-red-950/80 text-red-300 border-red-700",
    high:     "bg-orange-950/80 text-orange-300 border-orange-700",
    medium:   "bg-amber-950/80 text-amber-300 border-amber-700",
    low:      "bg-emerald-950/80 text-emerald-300 border-emerald-700",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${
        cfg[label] || cfg.low
      }`}
    >
      {label}
    </span>
  );
}

export default function IncidentQueue({ onOpenIncident }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);

    getIncidents()
      .then((data) => setIncidents(data.incidents || []))
      .catch((err) => {
        setError(
          err?.response?.data?.detail ||
            "Failed to load incidents. Ensure the backend is running."
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
        <span className="w-8 h-8 border-2 border-slate-700 border-t-red-500 rounded-full animate-spin" />
        <p className="text-sm">Loading incident queue…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaExclamationTriangle className="text-red-400" />
          <h2 className="text-lg font-bold text-white tracking-tight">
            Incident Queue
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-mono">
            {incidents.length}
          </span>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 text-xs transition cursor-pointer"
        >
          <FaSync className="text-xs" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-sm flex items-center gap-3">
          <FaExclamationTriangle className="shrink-0" />
          {error}
        </div>
      )}

      {!error && incidents.length === 0 && (
        <div className="flex flex-col items-center py-16 text-slate-500 gap-3">
          <FaFolderOpen className="text-4xl" />
          <p className="text-sm">No validated incidents found.</p>
          <p className="text-xs text-slate-600">
            Submit a disaster report first to see it here.
          </p>
        </div>
      )}

      {/* Incident Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {incidents.map((incident, idx) => (
          <motion.div
            key={incident.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-600 transition-all group"
          >
            {/* Card Top */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">
                  #{incident.short_id}
                </p>
                <h3 className="text-base font-bold text-white mt-0.5 tracking-tight">
                  {incident.type}
                </h3>
              </div>
              <SeverityBadge label={incident.severityLabel} />
            </div>

            {/* Evidence Thumbnail (if available) */}
            {(incident.thumbnailUrl || incident.imageUrl) && (
              <div className="mb-3 h-28 w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative">
                <img
                  src={
                    // Prefer Cloudinary-optimized thumbnail; fall back to legacy local URL
                    incident.thumbnailUrl
                      ? incident.thumbnailUrl
                      : incident.imageUrl.startsWith("http")
                        ? incident.imageUrl
                        : `http://127.0.0.1:8000${incident.imageUrl}`
                  }
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    e.target.parentElement.style.display = "none";
                  }}
                />
                <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-mono text-emerald-300 border border-emerald-500/30">
                  📸 Evidence
                </span>
              </div>
            )}

            {/* Location */}
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-3">
              <FaMapMarkerAlt className="text-red-500 shrink-0" />
              <span className="truncate">{incident.location}</span>
            </p>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-slate-950/60 rounded-xl p-2.5 text-center border border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Severity
                </p>
                <p className="text-lg font-extrabold text-white">
                  {incident.severity}
                  <span className="text-xs text-slate-500">/10</span>
                </p>
              </div>
              <div className="bg-slate-950/60 rounded-xl p-2.5 text-center border border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Traffic Impact
                </p>
                <p className="text-sm font-bold text-slate-200 uppercase mt-1">
                  {incident.traffic_impact || incident.trafficImpact || "Moderate"}
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                {incident.status}
              </span>

              <button
                type="button"
                onClick={() => onOpenIncident(incident)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-md shadow-red-950/40 cursor-pointer"
              >
                <FaFolderOpen className="text-xs" />
                Open
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
