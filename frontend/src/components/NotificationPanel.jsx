/**
 * NotificationPanel — lets admins select responder teams
 * and dispatch alerts for a given incident.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FaBell,
  FaCheckCircle,
  FaExclamationTriangle,
  FaHistory,
  FaPaperPlane,
} from "react-icons/fa";
import { sendNotification, getNotifications } from "../services/adminService";

const RESPONDERS = [
  { code: "sos",       label: "SOS Contacts",       icon: "🆘", color: "border-red-200 bg-red-50 text-red-900" },
  { code: "fire",      label: "Fire Brigade",        icon: "🚒", color: "border-orange-200 bg-orange-50 text-orange-900" },
  { code: "police",    label: "Police",              icon: "🚔", color: "border-blue-200 bg-blue-50 text-blue-900" },
  { code: "hospital",  label: "Hospital",            icon: "🏥", color: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  { code: "ambulance", label: "Ambulance Services",  icon: "🚑", color: "border-cyan-200 bg-cyan-50 text-cyan-900" },
];

export default function NotificationPanel({ incident }) {
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // success | error
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load notification history
  useEffect(() => {
    if (!incident?.id) return;

    setHistoryLoading(true);

    getNotifications(incident.id)
      .then((data) => setHistory(data.notifications || []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [incident?.id, result]);

  const toggle = (code) => {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSend = async () => {
    if (!selected.length) return;

    setSending(true);
    setResult(null);

    try {
      await sendNotification({
        incidentId: incident.id,
        recipients: selected,
        message: message.trim(),
      });

      setResult({ type: "success", text: `Alert dispatched to ${selected.length} team(s).` });
      setSelected([]);
      setMessage("");
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        "Failed to send notification. Check backend connection.";
      setResult({ type: "error", text: typeof detail === "string" ? detail : JSON.stringify(detail) });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Panel Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
        <FaBell className="text-amber-500" />
        <h3 className="text-base font-bold text-gray-900 tracking-tight">
          Notification Center
        </h3>
        <span className="ml-auto text-xs text-gray-400 font-mono font-bold">
          Incident #{incident?.short_id}
        </span>
      </div>

      {/* Responder Grid */}
      <div>
        <p className="text-xs uppercase tracking-wider text-gray-500 font-mono font-bold mb-3">
          Select Emergency Recipients
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {RESPONDERS.map(({ code, label, icon, color }) => {
            const active = selected.includes(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggle(code)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                  active
                    ? `${color} font-bold shadow-xs`
                    : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium"
                }`}
              >
                <span className="text-xl">{icon}</span>
                <span className="text-sm">
                  {label}
                </span>
                {active && (
                  <FaCheckCircle className="ml-auto text-emerald-600 text-sm shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional Message */}
      <div>
        <label className="text-xs uppercase tracking-wider text-gray-600 font-mono font-bold block mb-2">
          Custom Emergency Message (optional)
        </label>
        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Emergency alert for Zone A — immediate response required."
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15"
        />
      </div>

      {/* Result Banner */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
            result.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {result.type === "success" ? (
            <FaCheckCircle className="shrink-0 text-emerald-600" />
          ) : (
            <FaExclamationTriangle className="shrink-0 text-red-600" />
          )}
          {result.text}
        </motion.div>
      )}

      {/* Send Button */}
      <button
        type="button"
        onClick={handleSend}
        disabled={!selected.length || sending}
        className="btn-primary w-full justify-center disabled:opacity-50"
      >
        {sending ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Dispatching…
          </>
        ) : (
          <>
            <FaPaperPlane className="text-xs" />
            Dispatch Emergency Alert
            {selected.length > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full bg-blue-700 text-white text-xs font-bold font-mono">
                {selected.length}
              </span>
            )}
          </>
        )}
      </button>

      {/* Notification History */}
      {history.length > 0 && (
        <div className="pt-4 border-t border-gray-200 space-y-3">
          <div className="flex items-center gap-2">
            <FaHistory className="text-gray-400 text-xs" />
            <p className="text-xs uppercase tracking-wider text-gray-500 font-mono font-bold">
              Dispatch History
            </p>
          </div>
          <div className="space-y-2">
            {history.slice(0, 5).map((n, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs"
              >
                <FaCheckCircle className="text-emerald-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-gray-900 font-bold truncate">
                    {(n.recipients || []).map((r) => r.label).join(", ")}
                  </p>
                  <p className="text-gray-400 font-mono text-[11px] mt-0.5">
                    {new Date(n.dispatched_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
