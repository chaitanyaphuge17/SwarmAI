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
  FaMapMarkerAlt,
  FaArrowRight,
  FaComments,
  FaChevronDown,
  FaChevronUp,
  FaInfoCircle,
  FaChevronLeft,
  FaChevronRight,
  FaExclamationTriangle,
} from "react-icons/fa";
import {
  getIncidentWorkflow,
  getIncidentWorkflowSummary,
  getIncidentWorkflowGraph,
} from "../services/adminService";

const EVENT_TYPE_LABELS = {
  incident_created: { label: "Incident Created", color: "bg-purple-50 text-purple-700 border-purple-200" },
  agent_assigned: { label: "Agent Assigned", color: "bg-blue-50 text-blue-700 border-blue-200" },
  agent_started: { label: "Agent Started", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  agent_sent_message: { label: "Agent Message", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  agent_action_performed: { label: "Action Taken", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  agent_action_completed: { label: "Action Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  status_changed: { label: "Status Changed", color: "bg-amber-50 text-amber-700 border-amber-200" },
  incident_resolved: { label: "Incident Resolved", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  agent_action_failed: { label: "Action Failed", color: "bg-red-50 text-red-700 border-red-200" },
};

const AGENT_COLORS = {
  System: "bg-gray-100 border-gray-200 text-gray-800",
  CoordinatorAgent: "bg-amber-50 border-amber-200 text-amber-900",
  EmergencyAgent: "bg-red-50 border-red-200 text-red-900",
  TrafficAgent: "bg-blue-50 border-blue-200 text-blue-900",
  MedicalAgent: "bg-teal-50 border-teal-200 text-teal-900",
  ResourceAgent: "bg-purple-50 border-purple-200 text-purple-900",
  Admin: "bg-gray-100 border-gray-200 text-gray-800",
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
      <div className="bg-[#F6F8FC] border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <FaProjectDiagram className="text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400 font-bold uppercase tracking-widest">
                  Incident #{incident?.short_id || (incidentId ? incidentId.slice(0, 8).toUpperCase() : "")}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
                  summary?.workflow_status === "resolved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  summary?.workflow_status === "failed" ? "bg-red-50 text-red-700 border-red-200" :
                  "bg-blue-50 text-blue-700 border-blue-200 animate-pulse"
                }`}>
                  {summary?.workflow_status || "Active Workflow"}
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">
                {summary?.disaster_type || incident?.type || "Emergency Disaster"}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              <FaSync className={`text-xs ${loading ? "animate-spin text-blue-600" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider mb-1 font-bold">Location</p>
            <p className="text-xs font-bold text-gray-900 truncate flex items-center gap-1">
              <FaMapMarkerAlt className="text-red-500 shrink-0" />
              {summary?.location || incident?.location || "Unknown"}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider mb-1 font-bold">Timeline Events</p>
            <p className="text-sm font-extrabold text-blue-600 tabular-nums">
              {totalEvents} <span className="text-[10px] text-gray-400 font-normal">records</span>
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider mb-1 font-bold">Created Time</p>
            <p className="text-[11px] font-mono text-gray-700 truncate font-medium">{formattedCreatedTime}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider mb-1 font-bold">Last Activity</p>
            <p className="text-[11px] font-mono text-gray-700 truncate font-medium">{formattedUpdatedTime}</p>
          </div>
        </div>

        {/* Participating & Active Agents Badges */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-200 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-mono uppercase text-[10px] tracking-wider font-bold">Participating Agents:</span>
            <div className="flex flex-wrap gap-1.5">
              {(summary?.participating_agents || ["EmergencyAgent", "TrafficAgent", "MedicalAgent", "ResourceAgent"]).map((ag) => (
                <span key={ag} className="px-2.5 py-0.5 rounded-lg bg-white border border-gray-200 text-gray-800 text-[11px] font-bold flex items-center gap-1 shadow-2xs">
                  <FaRobot className="text-[10px] text-blue-600" />
                  {ag}
                </span>
              ))}
            </div>
          </div>

          {summary?.active_agents?.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-mono uppercase text-[10px] tracking-wider font-bold">Currently Active:</span>
              <div className="flex flex-wrap gap-1.5">
                {summary.active_agents.map((ag) => (
                  <span key={ag} className="px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
      <div className="bg-[#F6F8FC] border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FaProjectDiagram className="text-blue-600" />
            Agent Relationship & Inter-Agent Communication Graph
          </h4>
          <span className="text-[11px] text-gray-400 font-mono">Dynamic Graph from Stored Events</span>
        </div>

        {graphData.nodes.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-xs font-mono">
            No agent communications logged yet for this incident.
          </div>
        ) : (
          <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-4">
            {/* Agent Nodes Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
              {graphData.nodes.map((node) => {
                const colorScheme = AGENT_COLORS[node.id] || "bg-gray-100 border-gray-200 text-gray-800";
                return (
                  <div
                    key={node.id}
                    className={`${colorScheme} border rounded-xl p-3 shadow-2xs flex flex-col justify-between space-y-2`}
                  >
                    <div className="flex items-center justify-between">
                      <FaRobot className="text-base text-blue-600" />
                      <span className="px-2 py-0.5 rounded bg-white/80 text-[9px] font-mono font-bold border border-gray-200 text-gray-700">
                        {node.events_count} msgs
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-extrabold tracking-tight text-gray-900 truncate">{node.label}</p>
                      <p className="text-[9px] text-gray-500 truncate">{node.role}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dynamic Directed Communication Links */}
            {graphData.links.length > 0 && (
              <div className="pt-3 border-t border-gray-200 space-y-2">
                <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider font-bold">
                  Verified Directed Message Channels:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {graphData.links.map((link, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs"
                    >
                      <div className="flex items-center gap-2 text-gray-800 font-semibold truncate">
                        <span className="text-blue-700 font-mono text-[11px] truncate font-bold">{link.source}</span>
                        <FaArrowRight className="text-gray-400 text-[10px] shrink-0" />
                        <span className="text-teal-700 font-mono text-[11px] truncate font-bold">{link.target}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-mono text-[10px] font-bold">
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
      <div className="bg-[#F6F8FC] border border-gray-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-900 text-xs font-bold uppercase tracking-wider">
            <FaFilter className="text-blue-600" /> Filter & Search Timeline
          </div>
          {(selectedAgent || selectedEventType || selectedStatus || searchQuery) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] text-blue-600 hover:text-blue-700 font-mono font-bold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {/* Search Bar */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-3 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Search message content..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-900 text-xs placeholder:text-gray-400 focus:outline-none focus:border-blue-600 transition"
            />
          </div>

          {/* Agent Filter */}
          <select
            value={selectedAgent}
            onChange={(e) => {
              setSelectedAgent(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-blue-600 cursor-pointer font-medium"
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
            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-blue-600 cursor-pointer font-medium"
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
            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-blue-600 cursor-pointer font-medium"
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
          <h4 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FaComments className="text-blue-600" />
            Chronological Workflow & Communication Log
          </h4>
          <span className="text-xs text-gray-500 font-mono">
            Showing {events.length} of {totalEvents} events
          </span>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
            <FaExclamationTriangle className="shrink-0 text-lg" />
            {error}
          </div>
        )}

        {loading && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-400">
            <span className="w-7 h-7 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-xs font-mono text-gray-500">Loading incident workflow timeline…</p>
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2 bg-white border border-gray-200 rounded-2xl">
            <FaInfoCircle className="text-2xl text-gray-300" />
            <p className="text-sm font-semibold text-gray-700">No matching workflow events found.</p>
            <p className="text-xs text-gray-400">Adjust your search query or clear active filters.</p>
          </div>
        )}

        {!loading && events.length > 0 && (
          <div className="relative pl-4 border-l-2 border-gray-200 space-y-4">
            {events.map((evt, idx) => {
              const typeCfg = EVENT_TYPE_LABELS[evt.event_type] || {
                label: evt.event_type,
                color: "bg-gray-100 text-gray-700 border-gray-200",
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
                  <span className="absolute -left-[23px] top-4 w-3.5 h-3.5 rounded-full border-2 border-white bg-blue-600 group-hover:scale-125 transition-transform shadow-xs" />

                  <div className="bg-white border border-gray-200 hover:border-gray-300 rounded-2xl p-4 shadow-xs space-y-2.5 transition-all">
                    {/* Header line: Sender -> Receiver, Event Type badge, Time */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Sender */}
                        <span className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 text-xs font-bold flex items-center gap-1.5">
                          <FaRobot className="text-blue-600 text-xs" />
                          {evt.sender_agent_id || "System"}
                        </span>

                        {/* Receiver (if applicable) */}
                        {evt.receiver_agent_id && (
                          <>
                            <FaArrowRight className="text-gray-400 text-xs" />
                            <span className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-teal-800 text-xs font-bold flex items-center gap-1.5">
                              <FaRobot className="text-teal-600 text-xs" />
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
                        <span className="text-[11px] font-mono text-gray-400">{timeStr}</span>

                        {/* Status pill */}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          evt.status === "success" || evt.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          evt.status === "failed" ? "bg-red-50 text-red-700 border border-red-200" :
                          "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {evt.status}
                        </span>
                      </div>
                    </div>

                    {/* Content Message */}
                    <p className="text-xs text-gray-800 leading-relaxed font-sans font-medium">
                      {evt.message}
                    </p>

                    {/* Action & Result callout (if present) */}
                    {(evt.action || evt.result) && (
                      <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-1">
                        {evt.action && (
                          <p className="text-[11px] text-gray-700 flex items-start gap-1.5">
                            <span className="text-blue-700 font-bold font-mono">Action:</span>
                            <span className="text-gray-900 font-mono">{evt.action}</span>
                          </p>
                        )}
                        {evt.result && (
                          <p className="text-[11px] text-gray-600 flex items-start gap-1.5">
                            <span className="text-emerald-700 font-bold font-mono">Result:</span>
                            <span className="text-gray-700 italic">{evt.result}</span>
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
                          className="flex items-center gap-1 text-[10px] font-mono text-gray-400 hover:text-gray-700 transition cursor-pointer font-bold"
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
                              className="mt-2 p-3 rounded-xl bg-gray-900 border border-gray-800 text-[10px] font-mono text-emerald-400 overflow-x-auto"
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
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
            >
              <FaChevronLeft className="text-[10px]" /> Previous
            </button>
            <span className="text-xs font-mono text-gray-500 font-medium">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
            >
              Next <FaChevronRight className="text-[10px]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
