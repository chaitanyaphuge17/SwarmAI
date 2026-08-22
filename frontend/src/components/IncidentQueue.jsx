/**
 * IncidentQueue — displays validated incidents from MongoDB
 * as a card list for the Admin Dashboard entry point.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaFolderOpen,
  FaSync,
} from "react-icons/fa";
import { getIncidents } from "../services/adminService";

function SeverityBadge({ label }) {
  const cfg = {
    critical: "bg-red-50 text-red-700 border-red-200",
    high:     "bg-orange-50 text-orange-700 border-orange-200",
    medium:   "bg-amber-50 text-amber-700 border-amber-200",
    low:      "bg-emerald-50 text-emerald-700 border-emerald-200",
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
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
        <span className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Loading incident queue…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaExclamationTriangle className="text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">
            Incident Queue
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-mono font-bold">
            {incidents.length}
          </span>
        </div>
        <button
          type="button"
          onClick={load}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          <FaSync className="text-xs" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <FaExclamationTriangle className="shrink-0" />
          {error}
        </div>
      )}

      {!error && incidents.length === 0 && (
        <div className="flex flex-col items-center py-16 text-gray-400 gap-3 bg-white border border-gray-200 rounded-2xl p-8">
          <FaFolderOpen className="text-4xl text-gray-300" />
          <p className="text-sm font-semibold text-gray-700">No validated incidents found.</p>
          <p className="text-xs text-gray-400">
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
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-gray-300 transition-all group"
          >
            {/* Card Top */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="text-xs text-gray-400 font-mono uppercase tracking-wider font-semibold">
                  #{incident.short_id}
                </p>
                <h3 className="text-base font-bold text-gray-900 mt-0.5 tracking-tight">
                  {incident.type}
                </h3>
              </div>
              <SeverityBadge label={incident.severityLabel} />
            </div>

            {/* Evidence Thumbnail (if available) */}
            {(incident.thumbnailUrl || incident.imageUrl) && (
              <div className="mb-3 h-28 w-full rounded-xl overflow-hidden bg-gray-50 border border-gray-200 relative">
                <img
                  src={
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
                <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-gray-900/80 backdrop-blur-xs text-[9px] font-mono text-emerald-400 border border-gray-700">
                  📸 Evidence
                </span>
              </div>
            )}

            {/* Location */}
            <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-3">
              <FaMapMarkerAlt className="text-red-500 shrink-0" />
              <span className="truncate">{incident.location}</span>
            </p>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-gray-50 rounded-xl p-2.5 text-center border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                  Severity
                </p>
                <p className="text-base font-extrabold text-gray-900">
                  {incident.severity}
                  <span className="text-xs text-gray-400">/10</span>
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2.5 text-center border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                  Traffic Impact
                </p>
                <p className="text-xs font-bold text-gray-800 uppercase mt-1">
                  {incident.traffic_impact || incident.trafficImpact || "Moderate"}
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                {incident.status}
              </span>

              <button
                type="button"
                onClick={() => onOpenIncident(incident)}
                className="btn-primary text-xs px-3.5 py-1.5"
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
