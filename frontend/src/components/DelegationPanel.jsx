/**
 * DelegationPanel — the core Round 2 feature.
 * Allows admin to assign task, team, vehicle and time window,
 * run a conflict check, then confirm (or override) the delegation.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FaTasks,
  FaUsers,
  FaCar,
  FaClock,
  FaCheckCircle,
  FaExclamationTriangle,
  FaHistory,
} from "react-icons/fa";
import {
  checkConflict,
  confirmDelegation,
  getAssignments,
  getTeams,
  getVehicles,
} from "../services/adminService";
import ConflictBadge from "./ConflictBadge";
import ConflictModal from "./ConflictModal";

// ────────────────────────────────────────────────────────────
// Today's date/time helpers for default form values
// ────────────────────────────────────────────────────────────

function nowPlusHours(h) {
  const d = new Date();
  d.setHours(d.getHours() + h, 0, 0, 0);
  return d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
}

function toISO(localDTString) {
  return new Date(localDTString).toISOString();
}

export default function DelegationPanel({ incident }) {
  // ────────────────────────────────────────────────────────
  // Registry
  // ────────────────────────────────────────────────────────
  const [teams, setTeams] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  // ────────────────────────────────────────────────────────
  // Form state
  // ────────────────────────────────────────────────────────
  const [task, setTask] = useState("");
  const [teamId, setTeamId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [startTime, setStartTime] = useState(nowPlusHours(0));
  const [endTime, setEndTime] = useState(nowPlusHours(2));

  // ────────────────────────────────────────────────────────
  // Conflict state
  // ────────────────────────────────────────────────────────
  const [badgeStatus, setBadgeStatus] = useState("none");
  const [conflictResult, setConflictResult] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // ────────────────────────────────────────────────────────
  // Submission state
  // ────────────────────────────────────────────────────────
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(null); // success object
  const [submitError, setSubmitError] = useState(null);

  // ────────────────────────────────────────────────────────
  // Assignment history
  // ────────────────────────────────────────────────────────
  const [assignments, setAssignments] = useState([]);

  // Load teams + vehicles + history
  useEffect(() => {
    getTeams()
      .then(setTeams)
      .catch(() => setTeams([]));

    getVehicles()
      .then(setVehicles)
      .catch(() => setVehicles([]));
  }, []);

  useEffect(() => {
    if (!incident?.id) return;
    loadAssignments();
  }, [incident?.id, confirmed]);

  const loadAssignments = () => {
    getAssignments(incident.id)
      .then((d) => setAssignments(d.assignments || []))
      .catch(() => setAssignments([]));
  };

  // Reset badge when key fields change
  useEffect(() => {
    setBadgeStatus("none");
    setConflictResult(null);
    setConfirmed(null);
    setSubmitError(null);
  }, [teamId, vehicleId, startTime, endTime, task]);

  // ────────────────────────────────────────────────────────
  // CONFLICT CHECK
  // ────────────────────────────────────────────────────────
  const handleCheck = async () => {
    if (!teamId || !task.trim()) return;

    setBadgeStatus("checking");
    setConflictResult(null);

    try {
      const result = await checkConflict({
        incidentId: incident.id,
        teamId,
        vehicleId: vehicleId || "",
        task: task.trim(),
        startTime: toISO(startTime),
        endTime: toISO(endTime),
      });

      setConflictResult(result);

      if (!result.hasConflict) {
        setBadgeStatus("clear");
      } else if (result.severity === "high") {
        setBadgeStatus("blocked");
      } else {
        setBadgeStatus("warning");
      }

      setShowModal(true);
    } catch (err) {
      setBadgeStatus("none");
      setSubmitError(
        err?.response?.data?.detail ||
          "Conflict check failed. Ensure the backend is running."
      );
    }
  };

  // ────────────────────────────────────────────────────────
  // CONFIRM (from modal)
  // ────────────────────────────────────────────────────────
  const handleConfirm = async (override = false) => {
    setShowModal(false);
    setConfirming(true);
    setSubmitError(null);

    try {
      const result = await confirmDelegation({
        incidentId: incident.id,
        teamId,
        vehicleId: vehicleId || "",
        task: task.trim(),
        startTime: toISO(startTime),
        endTime: toISO(endTime),
        override,
      });

      setConfirmed(result);
      setBadgeStatus("clear");

      // Reset form
      setTask("");
      setTeamId("");
      setVehicleId("");
      setStartTime(nowPlusHours(0));
      setEndTime(nowPlusHours(2));
      setConflictResult(null);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail?.conflictResult) {
        setConflictResult(detail.conflictResult);
        setBadgeStatus("blocked");
        setShowModal(true);
      } else {
        setSubmitError(
          typeof detail === "string"
            ? detail
            : "Delegation failed. Check backend."
        );
      }
    } finally {
      setConfirming(false);
    }
  };

  // Confirm is enabled only when conflict check passed
  const canConfirmDirect =
    badgeStatus === "clear" && conflictResult !== null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FaTasks className="text-blue-600" />
          <h3 className="text-base font-bold text-gray-900 tracking-tight">
            Delegation Center
          </h3>
        </div>
        <ConflictBadge status={badgeStatus} />
      </div>

      {/* Success Banner */}
      {confirmed && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm"
        >
          <FaCheckCircle className="text-lg shrink-0 mt-0.5 text-emerald-600" />
          <div>
            <p className="font-bold">Delegation Confirmed</p>
            <p className="text-xs text-emerald-700 font-mono mt-0.5">
              Assignment ID: {confirmed.assignmentId?.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </motion.div>
      )}

      {/* Error Banner */}
      {submitError && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
        >
          <FaExclamationTriangle className="text-lg shrink-0 mt-0.5 text-red-600" />
          <p>{submitError}</p>
        </motion.div>
      )}

      {/* Form */}
      <div className="space-y-4">
        {/* Task */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-gray-600 font-semibold mb-2">
            <FaTasks className="text-xs text-blue-600" /> Task / Responsibility
          </label>
          <textarea
            rows={2}
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="e.g. Secure perimeter and coordinate emergency response in Zone A."
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15"
          />
        </div>

        {/* Team */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-gray-600 font-semibold mb-2">
            <FaUsers className="text-xs text-blue-600" /> Assign Team
          </label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-blue-600 cursor-pointer font-medium"
          >
            <option value="">— Select Team —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Vehicle */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-gray-600 font-semibold mb-2">
            <FaCar className="text-xs text-blue-600" /> Vehicle (optional)
          </label>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-blue-600 cursor-pointer font-medium"
          >
            <option value="">— No vehicle / select later —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        {/* Time Window */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-gray-600 font-semibold mb-2">
              <FaClock className="text-xs text-blue-600" /> Start Time
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-600 font-mono"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-gray-600 font-semibold mb-2">
              <FaClock className="text-xs text-blue-600" /> End Time
            </label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-600 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleCheck}
          disabled={!teamId || !task.trim() || confirming}
          className="btn-secondary flex-1 justify-center disabled:opacity-50"
        >
          {badgeStatus === "checking" ? (
            <span className="w-4 h-4 border-2 border-gray-400 border-t-blue-600 rounded-full animate-spin" />
          ) : (
            <FaExclamationTriangle className="text-amber-500 text-xs" />
          )}
          Check Conflict
        </button>

        <button
          type="button"
          onClick={() => handleConfirm(false)}
          disabled={!canConfirmDirect || confirming}
          className="btn-primary flex-1 justify-center disabled:opacity-50"
        >
          {confirming ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <FaCheckCircle className="text-xs" />
          )}
          Confirm Delegation
        </button>
      </div>

      {/* Assignment History */}
      {assignments.length > 0 && (
        <div className="pt-4 border-t border-gray-200 space-y-3">
          <div className="flex items-center gap-2">
            <FaHistory className="text-gray-400 text-xs" />
            <p className="text-xs uppercase tracking-wider text-gray-500 font-mono font-bold">
              Assignment History
            </p>
          </div>
          <div className="space-y-2">
            {assignments.slice(0, 5).map((a, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 font-bold">
                    {teams.find((t) => t.id === a.teamId)?.name || a.teamId}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      a.status === "active"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-gray-100 text-gray-600 border border-gray-200"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <p className="text-gray-600 font-sans truncate">{a.task}</p>
                {a.startTime && (
                  <p className="text-gray-400 font-mono text-[11px]">
                    {new Date(a.startTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" → "}
                    {new Date(a.endTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conflict Modal */}
      {showModal && conflictResult && (
        <ConflictModal
          conflictResult={conflictResult}
          onModify={() => setShowModal(false)}
          onOverride={() => handleConfirm(true)}
          onCancel={() => {
            setShowModal(false);
            setBadgeStatus("none");
            setConflictResult(null);
          }}
        />
      )}
    </div>
  );
}
