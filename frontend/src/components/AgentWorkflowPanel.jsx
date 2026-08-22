/**
 * AgentWorkflowPanel — Complete Incident Agent Workflow & Communication View.
 *
 * Provides:
 *   1. Incident Summary Header (IDs, Status, Timestamps, Active & Participating Agents)
 *   2. Dynamic Visual Workflow Graph (Nodes & Directed Links from persisted messages)
 *   3. Filter & Search Controls (Agent, Event Type, Status, Content Search)
 *   4. Chronological Timeline & Conversation Layout (Sender -> Receiver badges, action, results)
 *   5. Expandable Metadata Viewer
 *   6. Real-Time WebSocket updates via /ws/disaster
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaProjectDiagram,
  FaSearch,
  FaFilter,
  FaSync,
  FaRobot,
  FaUserShield,
  FaCheckCircle,
  FaExclamationTriangle,
  FaClock,
  FaArrowRight,
  FaComments,
  FaChevronDown,
  FaChevronUp,
  FaInfoCircle,
  FaChevronLeft,
  FaChevronRight,
  FaMapMarkerAlt,
  FaExchangeAlt,
  FaTimesCircle,
} from "react-icons/fa";
import {
  getIncidentWorkflow,
  getIncidentWorkflowSummary,
  getIncidentWorkflowGraph,
} from "../services/adminService";

const EVENT_TYPE_LABELS = {
  incident_created: { label: "Incident Created", color: "bg-purple-950/80 text-purple-300 border-purple-800" },
  agent_assigned: { label: "Agent Assigned", color: "bg-blue-950/80 text-blue-300 border-blue-800" },
  agent_started: { label: "Agent Started", color: "bg-cyan-950/80 text-cyan-300 border-cyan-800" },
  agent_sent_message: { label: "Agent Message", color: "bg-indigo-950/80 text-indigo-300 border-indigo-800" },
  agent_action_performed: { label: "Action Taken", color: "bg-emerald-950/80 text-emerald-300 border-emerald-800" },
  agent_action_completed: { label: "Action Completed", color: "bg-emerald-950/80 text-emerald-300 border-emerald-800" },
  status_changed: { label: "Status Changed", color: "bg-amber-950/80 text-amber-300 border-amber-800" },
  incident_resolved: { label: "Incident Resolved", color: "bg-emerald-900 text-emerald-200 border-emerald-600" },
  agent_action_failed: { label: "Action Failed", color: "bg-red-950/80 text-red-300 border-red-800" },
};

const AGENT_COLORS = {
  System: "from-slate-700 to-slate-900 border-slate-600 text-slate-200",
  CoordinatorAgent: "from-amber-600 to-amber-800 border-amber-500 text-amber-100",
  EmergencyAgent: "from-red-600 to-red-800 border-red-500 text-red-100",
  TrafficAgent: "from-blue-600 to-blue-800 border-blue-500 text-blue-100",
  MedicalAgent: "from-teal-600 to-teal-800 border-teal-500 text-teal-100",
  ResourceAgent: "from-purple-600 to-purple-800 border-purple-500 text-purple-100",
  Admin: "from-slate-800 to-slate-950 border-slate-600 text-slate-200",
};

export default function AgentWorkflowPanel({ incident }) {
  const incidentId = incident?.id || incident?.event_id;

  // State
  const [summary, setSummary] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [events, setEvents] = useState([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Pagination State
  const [page, setPage] = useState(1);
  const [limit] = useState(30);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedEventType, setSelectedEventType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Metadata expansion state
  const [expandedEvents, setExpandedEvents] = useState({});

  const toggleExpand = (id) => {
    setExpandedEvents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Fetch Workflow Data
  const fetchData = useCallback(() => {
    if (!incidentId) return;

    setLoading(true);
    setError(null);

    Promise.all([
      getIncidentWorkflowSummary(incidentId),
      getIncidentWorkflowGraph(incidentId),
      getIncidentWorkflow(incidentId, {
        page,
        limit,
        agent: selectedAgent || undefined,
        event_type: selectedEventType || undefined,
        status: selectedStatus || undefined,
        search: searchQuery || undefined,
      }),
    ])
      .then(([summaryRes, graphRes, workflowRes]) => {
        setSummary(summaryRes);
        setGraphData(graphRes);
        setEvents(workflowRes.events || []);
        setTotalEvents(workflowRes.total || 0);
        setTotalPages(workflowRes.pages || 1);
      })
      .catch((err) => {
        console.error("Failed to load incident workflow:", err);
        setError(err?.response?.data?.detail || "Failed to load workflow history.");
      })
      .finally(() => setLoading(false));
  }, [incidentId, page, limit, selectedAgent, selectedEventType, selectedStatus, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time WebSocket connection to /ws/disaster
  useEffect(() => {
    if (!incidentId) return;

    const wsUrl = (import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000")
      .replace(/^http/, "ws") + "/ws/disaster";

    let socket = null;
    try {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          if (payload.type === "workflow_event" && String(payload.incident_id) === String(incidentId)) {
            const newEvt = payload.event;
            if (newEvt) {
              setEvents((prev) => {
                if (prev.some((e) => e.id === newEvt.id)) return prev;
                return [...prev, newEvt];
              });
              setTotalEvents((prev) => prev + 1);
            }
          }
        } catch {
          // ignore non-json messages
        }
      };
    } catch {
      // WS fallback silent
    }

    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [incidentId]);

  const handleResetFilters = () => {
    setSelectedAgent("");
    setSelectedEventType("");
    setSelectedStatus("");
    setSearchQuery("");
    setPage(1);
  };

  const formattedCreatedTime = useMemo(() => {
    const raw = summary?.created_at || incident?.createdAt || incident?.validatedAt;
    if (!raw) return "N/A";
    try {
      return new Date(raw).toLocaleString();
    } catch {
      return String(raw);
    }
  }, [summary, incident]);

  const formattedUpdatedTime = useMemo(() => {
    const raw = summary?.updated_at;
    if (!raw) return "N/A";
    try {
      return new Date(raw).toLocaleString();
    } catch {
      return String(raw);
    }
  }, [summary]);

  return (
    <div className="space-y-6">
      {/* ────────────────────────────────────────────────────────────
          1. INCIDENT SUMMARY HEADER METRICS
      ──────────────────────────────────────────────────────────── */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-md">
              <FaProjectDiagram className="text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                  Incident #{incident?.short_id || (incidentId ? incidentId.slice(0, 8).toUpperCase() : "")}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
                  summary?.workflow_status === "resolved" ? "bg-emerald-950 text-emerald-300 border-emerald-700" :
                  summary?.workflow_status === "failed" ? "bg-red-950 text-red-300 border-red-700" :
                  "bg-indigo-950 text-indigo-300 border-indigo-700 animate-pulse"
                }`}>
                  {summary?.workflow_status || "Active Workflow"}
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-white tracking-tight">
                {summary?.disaster_type || incident?.type || "Emergency Disaster"}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              <FaSync className={`text-xs ${loading ? "animate-spin text-indigo-400" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Location</p>
            <p className="text-xs font-bold text-slate-200 truncate flex items-center gap-1">
              <FaMapMarkerAlt className="text-red-500 shrink-0" />
              {summary?.location || incident?.location || "Unknown"}
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Timeline Events</p>
            <p className="text-sm font-extrabold text-indigo-300 tabular-nums">
              {totalEvents} <span className="text-[10px] text-slate-500 font-normal">records</span>
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Created Time</p>
            <p className="text-[11px] font-mono text-slate-300 truncate">{formattedCreatedTime}</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Last Activity</p>
            <p className="text-[11px] font-mono text-slate-300 truncate">{formattedUpdatedTime}</p>
          </div>
        </div>

        {/* Participating & Active Agents Badges */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-mono uppercase text-[10px] tracking-wider">Participating Agents:</span>
            <div className="flex flex-wrap gap-1.5">
              {(summary?.participating_agents || ["EmergencyAgent", "TrafficAgent", "MedicalAgent", "ResourceAgent"]).map((ag) => (
                <span key={ag} className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1">
                  <FaRobot className="text-[10px] text-indigo-400" />
                  {ag}
                </span>
              ))}
            </div>
          </div>

          {summary?.active_agents?.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-mono uppercase text-[10px] tracking-wider">Currently Active:</span>
              <div className="flex flex-wrap gap-1.5">
                {summary.active_agents.map((ag) => (
                  <span key={ag} className="px-2 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-[11px] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {ag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────
          2. WORKFLOW GRAPH SECTION (Dynamic nodes & links)
      ──────────────────────────────────────────────────────────── */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <FaProjectDiagram className="text-indigo-400" />
            Agent Relationship & Inter-Agent Communication Graph
          </h4>
          <span className="text-[11px] text-slate-500 font-mono">Dynamic Graph from Stored Events</span>
        </div>

        {graphData.nodes.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs font-mono">
            No agent communications logged yet for this incident.
          </div>
        ) : (
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4">
            {/* Agent Nodes Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
              {graphData.nodes.map((node) => {
                const colorScheme = AGENT_COLORS[node.id] || "from-slate-700 to-slate-900 border-slate-600 text-slate-200";
                return (
                  <div
                    key={node.id}
                    className={`bg-gradient-to-br ${colorScheme} border rounded-xl p-3 shadow-lg flex flex-col justify-between space-y-2`}
                  >
                    <div className="flex items-center justify-between">
                      <FaRobot className="text-base" />
                      <span className="px-2 py-0.5 rounded bg-black/40 text-[9px] font-mono font-bold">
                        {node.events_count} msgs
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-extrabold tracking-tight truncate">{node.label}</p>
                      <p className="text-[9px] opacity-80 truncate">{node.role}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dynamic Directed Communication Links */}
            {graphData.links.length > 0 && (
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                  Verified Directed Message Channels:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {graphData.links.map((link, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2 text-slate-200 font-semibold truncate">
                        <span className="text-indigo-300 font-mono text-[11px] truncate">{link.source}</span>
                        <FaArrowRight className="text-slate-500 text-[10px] shrink-0" />
                        <span className="text-teal-300 font-mono text-[11px] truncate">{link.target}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-950 border border-indigo-800 text-indigo-300 font-mono text-[10px] font-bold">
                        {link.count} msg{link.count > 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────
          3. FILTERING & SEARCH CONTROLS
      ──────────────────────────────────────────────────────────── */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 text-xs font-bold uppercase tracking-wider">
            <FaFilter className="text-indigo-400" /> Filter & Search Timeline
          </div>
          {(selectedAgent || selectedEventType || selectedStatus || searchQuery) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-mono cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {/* Search Bar */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-3 text-slate-500 text-xs" />
            <input
              type="text"
              placeholder="Search message content..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Agent Filter */}
          <select
            value={selectedAgent}
            onChange={(e) => {
              setSelectedAgent(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Agents</option>
            <option value="CoordinatorAgent">CoordinatorAgent</option>
            <option value="EmergencyAgent">EmergencyAgent</option>
            <option value="TrafficAgent">TrafficAgent</option>
            <option value="MedicalAgent">MedicalAgent</option>
            <option value="ResourceAgent">ResourceAgent</option>
            <option value="System">System</option>
            <option value="Admin">Admin</option>
          </select>

          {/* Event Type Filter */}
          <select
            value={selectedEventType}
            onChange={(e) => {
              setSelectedEventType(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Event Types</option>
            <option value="incident_created">Incident Created</option>
            <option value="agent_assigned">Agent Assigned</option>
            <option value="agent_started">Agent Started</option>
            <option value="agent_sent_message">Agent Message</option>
            <option value="agent_action_completed">Action Completed</option>
            <option value="status_changed">Status Changed</option>
            <option value="incident_resolved">Incident Resolved</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="success">Success</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────
          4. CHRONOLOGICAL TIMELINE & CONVERSATION VIEW
      ──────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <FaComments className="text-indigo-400" />
            Chronological Workflow & Communication Log
          </h4>
          <span className="text-xs text-slate-400 font-mono">
            Showing {events.length} of {totalEvents} events
          </span>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-sm flex items-center gap-3">
            <FaExclamationTriangle className="shrink-0 text-lg" />
            {error}
          </div>
        )}

        {loading && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <span className="w-7 h-7 border-2 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-xs font-mono">Loading incident workflow timeline…</p>
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2 bg-slate-950/40 border border-slate-800 rounded-2xl">
            <FaInfoCircle className="text-2xl" />
            <p className="text-sm font-semibold">No matching workflow events found.</p>
            <p className="text-xs">Adjust your search query or clear active filters.</p>
          </div>
        )}

        {!loading && events.length > 0 && (
          <div className="relative pl-4 border-l-2 border-slate-800 space-y-4">
            {events.map((evt, idx) => {
              const typeCfg = EVENT_TYPE_LABELS[evt.event_type] || {
                label: evt.event_type,
                color: "bg-slate-800 text-slate-300 border-slate-700",
              };

              const isExpanded = expandedEvents[evt.id];
              const timeStr = evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : "";

              return (
                <motion.div
                  key={evt.id || idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                  className="relative group"
                >
                  {/* Timeline bullet dot */}
                  <span className="absolute -left-[23px] top-4 w-3.5 h-3.5 rounded-full border-2 border-slate-950 bg-indigo-500 group-hover:scale-125 transition-transform" />

                  <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-xl space-y-2.5 transition-all">
                    {/* Header line: Sender -> Receiver, Event Type badge, Time */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Sender */}
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5">
                          <FaRobot className="text-indigo-400 text-xs" />
                          {evt.sender_agent_id || "System"}
                        </span>

                        {/* Receiver (if applicable) */}
                        {evt.receiver_agent_id && (
                          <>
                            <FaArrowRight className="text-slate-500 text-xs" />
                            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-teal-300 text-xs font-bold flex items-center gap-1.5">
                              <FaRobot className="text-teal-400 text-xs" />
                              {evt.receiver_agent_id}
                            </span>
                          </>
                        )}

                        {/* Event Type Badge */}
                        <span className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${typeCfg.color}`}>
                          {typeCfg.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-500">{timeStr}</span>

                        {/* Status pill */}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          evt.status === "success" || evt.status === "active" ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800" :
                          evt.status === "failed" ? "bg-red-950/60 text-red-400 border border-red-800" :
                          "bg-amber-950/60 text-amber-400 border border-amber-800"
                        }`}>
                          {evt.status}
                        </span>
                      </div>
                    </div>

                    {/* Content Message */}
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">
                      {evt.message}
                    </p>

                    {/* Action & Result callout (if present) */}
                    {(evt.action || evt.result) && (
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/90 text-xs space-y-1">
                        {evt.action && (
                          <p className="text-[11px] text-slate-300 flex items-start gap-1.5">
                            <span className="text-indigo-400 font-bold font-mono">Action:</span>
                            <span className="text-slate-200 font-mono">{evt.action}</span>
                          </p>
                        )}
                        {evt.result && (
                          <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
                            <span className="text-emerald-400 font-bold font-mono">Result:</span>
                            <span className="text-slate-300 italic">{evt.result}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Metadata Toggle */}
                    {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleExpand(evt.id)}
                          className="flex items-center gap-1 text-[10px] font-mono text-slate-500 hover:text-slate-300 transition cursor-pointer"
                        >
                          {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                          {isExpanded ? "Hide detailed metadata" : "Inspect metadata JSON"}
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.pre
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-2 p-3 rounded-xl bg-black/60 border border-slate-800 text-[10px] font-mono text-emerald-400 overflow-x-auto"
                            >
                              {JSON.stringify(evt.metadata, null, 2)}
                            </motion.pre>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-800 cursor-pointer"
            >
              <FaChevronLeft className="text-[10px]" /> Previous
            </button>
            <span className="text-xs font-mono text-slate-400">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-800 cursor-pointer"
            >
              Next <FaChevronRight className="text-[10px]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
