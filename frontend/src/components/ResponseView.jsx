import { useState } from "react";
import {
  FaMapMarkerAlt,
  FaExclamationTriangle,
  FaCheckCircle,
  FaCar,
  FaHospital,
  FaRoute,
  FaFirstAid,
  FaBoxes,
  FaShieldAlt,
  FaRedo,
  FaImage,
  FaMap,
} from "react-icons/fa";

// ─────────────────────────────────────────────────────────────
// Tiny helper: severity colour
// ─────────────────────────────────────────────────────────────
function severityColor(score) {
  if (score === null || score === undefined) return "#64748b";
  if (score >= 8) return "#ef4444";
  if (score >= 5) return "#f59e0b";
  return "#22c55e";
}

// ─────────────────────────────────────────────────────────────
// Thin horizontal progress bar
// ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max = 100, color = "#dc2626" }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      style={{
        height: "6px",
        borderRadius: "9999px",
        backgroundColor: "var(--swarm-border)",
        overflow: "hidden",
        marginTop: "6px",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: "9999px",
          backgroundColor: color,
          transition: "width 0.8s ease",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Card wrapper
// ─────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div
      style={{
        backgroundColor: "var(--swarm-surface)",
        border: "1px solid var(--swarm-border)",
        borderRadius: "14px",
        padding: "20px 24px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section heading inside a card
// ─────────────────────────────────────────────────────────────
function CardHeading({ icon: Icon, label, iconColor = "#dc2626" }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        paddingBottom: "12px",
        marginBottom: "14px",
        borderBottom: "1px solid var(--swarm-border)",
      }}
    >
      {Icon && <Icon style={{ color: iconColor, flexShrink: 0 }} />}
      <span
        style={{
          fontWeight: 700,
          fontSize: "0.95rem",
          color: "var(--swarm-text-strong)",
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Compact tag pill
// ─────────────────────────────────────────────────────────────
function Tag({ children, danger }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: "8px",
        fontSize: "0.78rem",
        fontWeight: 600,
        backgroundColor: danger
          ? "rgba(239,68,68,0.10)"
          : "rgba(100,116,139,0.12)",
        color: danger ? "#ef4444" : "var(--swarm-text-secondary)",
        border: danger
          ? "1px solid rgba(239,68,68,0.25)"
          : "1px solid var(--swarm-border)",
      }}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Impact level badge
// ─────────────────────────────────────────────────────────────
function ImpactBadge({ level }) {
  const l = String(level || "").toLowerCase();
  let bg, color, border;
  if (l === "high") {
    bg = "rgba(239,68,68,0.10)";
    color = "#ef4444";
    border = "rgba(239,68,68,0.30)";
  } else if (l === "medium") {
    bg = "rgba(245,158,11,0.10)";
    color = "#f59e0b";
    border = "rgba(245,158,11,0.30)";
  } else {
    bg = "rgba(34,197,94,0.10)";
    color = "#22c55e";
    border = "rgba(34,197,94,0.30)";
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "6px",
        fontSize: "0.78rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        backgroundColor: bg,
        color,
        border: `1px solid ${border}`,
      }}
    >
      {level || "—"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Metric cell (used in key metrics grid)
// ─────────────────────────────────────────────────────────────
function MetricCell({ label, value, note, children }) {
  return (
    <div
      style={{
        backgroundColor: "var(--swarm-surface-secondary)",
        border: "1px solid var(--swarm-border)",
        borderRadius: "10px",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--swarm-text-muted)",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      {value !== undefined && (
        <div
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "var(--swarm-text-strong)",
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
      )}
      {note && (
        <div
          style={{
            fontSize: "0.72rem",
            color: "var(--swarm-text-muted)",
            marginTop: "2px",
          }}
        >
          {note}
        </div>
      )}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Agent recommendation card
// ─────────────────────────────────────────────────────────────
function AgentCard({ icon: Icon, label, text, iconColor }) {
  if (!text) return null;
  return (
    <div
      style={{
        backgroundColor: "var(--swarm-surface-secondary)",
        border: "1px solid var(--swarm-border)",
        borderRadius: "10px",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          fontSize: "0.7rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: iconColor,
          marginBottom: "8px",
        }}
      >
        {Icon && <Icon />}
        {label}
      </div>
      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--swarm-text-secondary)",
          lineHeight: 1.55,
          margin: 0,
        }}
      >
        {text}
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════
export default function ResponseView({
  data,
  onReset,
  onViewMap,
  userLocation = null,
}) {
  // Guard
  if (!data || !data.event) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "3rem 0",
          color: "var(--swarm-text-muted)",
        }}
      >
        <p>No disaster response data available.</p>
        <button
          type="button"
          onClick={onReset}
          style={{
            marginTop: "16px",
            padding: "10px 24px",
            borderRadius: "10px",
            backgroundColor: "#dc2626",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.875rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          Report an Incident
        </button>
      </div>
    );
  }

  // ── Destructure backend fields ──────────────────────────────
  const {
    event,
    location: loc = {},
    responses = [],
    route_coordinates = [],
    best_route = [],
    image_processing = {},
  } = data;

  // Prefer image_processing counts; fallback to event fields
  const totalImages = image_processing.total_images ?? event.total_images ?? 0;
  const validImages = image_processing.accepted_images ?? event.valid_images ?? totalImages;
  const rejectedImages = image_processing.rejected_images ?? event.rejected_images ?? 0;

  // Event scalars
  const disasterType = event.disaster_type || event.disaster || "Disaster Event";
  const locationName = loc.name || event.location || "Incident Location";
  const validatedAt = event.validatedAt || null;
  const validationStatus = event.validationStatus || "VALIDATED";

  // Numeric fields
  const severity = typeof event.severity === "number" ? event.severity : null;  // 0-10
  const confidence = typeof event.confidence === "number" ? event.confidence : null;  // 0-1

  // Other event fields
  const victimEstimate = event.victim_estimate !== null && event.victim_estimate !== undefined
    ? event.victim_estimate
    : (typeof event.victims === "number" ? event.victims : null);
  const evacuationRequired = Boolean(event.evacuation_required);
  const trafficImpact = event.traffic_impact || "";
  const medicalAccessImpact = event.medical_access_impact || "";
  const summary = event.summary || "";
  const observations = Array.isArray(event.observations) ? event.observations : [];
  const hazards = Array.isArray(event.hazards) ? event.hazards : [];
  const infrastructureDmg = Array.isArray(event.infrastructure_damage) ? event.infrastructure_damage : [];

  // ── Extract agents ──────────────────────────────────────────
  const extractAgent = (name) => {
    if (!Array.isArray(responses)) return null;
    for (const item of responses) {
      if (!item) continue;
      if (item[name]) return item[name];
      if (item.agent === name) return item;
      if (item.data?.agent === name) return item.data;
    }
    return null;
  };

  const emergencyData = extractAgent("EmergencyAgent");
  const trafficData = extractAgent("TrafficAgent");
  const medicalData = extractAgent("MedicalAgent");
  const resourceData = extractAgent("ResourceAgent");

  const fmt = (decision) => {
    if (decision === null || decision === undefined) return "";
    if (typeof decision === "string" || typeof decision === "number") return String(decision);
    if (typeof decision === "object" && decision.recommendation) return String(decision.recommendation);
    return JSON.stringify(decision);
  };

  const emergencyRec = fmt(emergencyData?.decision);
  const medicalRec = fmt(medicalData?.decision);
  const resourceRec = fmt(resourceData?.decision);
  const routeStatus = trafficData?.traffic_response?.route_status || "";

  // Formatted timestamp
  const timestampStr = validatedAt
    ? (() => {
      try {
        return new Date(validatedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
      } catch {
        return null;
      }
    })()
    : null;

  // ── Route waypoints (only real data) ───────────────────────
  const hasRoute = Array.isArray(best_route) && best_route.length > 0;

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: "1024px", margin: "0 auto", paddingBottom: "3rem" }}>
      {/* ── 1. INCIDENT HEADER ───────────────────────────────── */}
      <Card
        style={{
          marginBottom: "20px",
          borderLeft: `4px solid #dc2626`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div>
            {/* Status pill */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.7rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "#22c55e",
                marginBottom: "10px",
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: "#22c55e",
                  display: "inline-block",
                  animation: "pulse 2s infinite",
                }}
              />
              {validationStatus}
            </div>

            <h1
              style={{
                fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
                fontWeight: 800,
                color: "var(--swarm-text-strong)",
                margin: "0 0 6px",
                letterSpacing: "-0.025em",
                lineHeight: 1.15,
              }}
            >
              {disasterType}
            </h1>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: "var(--swarm-text-muted)",
                fontSize: "0.875rem",
              }}
            >
              <FaMapMarkerAlt style={{ color: "#dc2626", flexShrink: 0 }} />
              <span>{locationName}</span>
            </div>

            {timestampStr && (
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--swarm-text-faint)",
                  marginTop: "4px",
                }}
              >
                Analysed: {timestampStr}
              </div>
            )}
          </div>

          {/* Evacuation status */}
          <div
            style={{
              padding: "12px 18px",
              borderRadius: "10px",
              backgroundColor: evacuationRequired
                ? "rgba(239,68,68,0.08)"
                : "rgba(34,197,94,0.08)",
              border: `1px solid ${evacuationRequired ? "rgba(239,68,68,0.30)" : "rgba(34,197,94,0.30)"}`,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              minWidth: "0",
              flexShrink: 0,
            }}
          >
            {evacuationRequired ? (
              <FaExclamationTriangle style={{ color: "#ef4444", fontSize: "1.1rem", flexShrink: 0 }} />
            ) : (
              <FaCheckCircle style={{ color: "#22c55e", fontSize: "1.1rem", flexShrink: 0 }} />
            )}
            <div>
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: evacuationRequired ? "#ef4444" : "#22c55e",
                }}
              >
                {evacuationRequired ? "Evacuation Required" : "No Evacuation Order"}
              </div>
              <div
                style={{ fontSize: "0.72rem", color: "var(--swarm-text-muted)", marginTop: "2px" }}
              >
                {evacuationRequired
                  ? "Immediate action recommended"
                  : "Monitor local directives"}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── 2. EXECUTIVE SUMMARY ─────────────────────────────── */}
      {summary && (
        <Card style={{ marginBottom: "20px" }}>
          <CardHeading icon={FaShieldAlt} label="Executive Summary" />
          <p
            style={{
              fontSize: "0.9rem",
              color: "var(--swarm-text-secondary)",
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            {summary}
          </p>
        </Card>
      )}

      {/* ── 3. KEY METRICS ───────────────────────────────────── */}
      <Card style={{ marginBottom: "20px" }}>
        <CardHeading icon={FaShieldAlt} label="Key Metrics" iconColor="#dc2626" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
          }}
        >
          {/* Severity */}
          {severity !== null && (
            <MetricCell label="Severity" value={`${severity} / 10`}>
              <ProgressBar value={severity} max={10} color={severityColor(severity)} />
            </MetricCell>
          )}

          {/* Confidence */}
          {confidence !== null && (
            <MetricCell
              label="AI Confidence"
              value={`${Math.round(confidence * 100)}%`}
            >
              <ProgressBar value={Math.round(confidence * 100)} max={100} color="#3b82f6" />
            </MetricCell>
          )}

          {/* Victim estimate */}
          {victimEstimate !== null && victimEstimate !== undefined && (
            <MetricCell label="Victim Estimate" value={victimEstimate} note="reported / estimated" />
          )}

          {/* Evacuation */}
          <MetricCell label="Evacuation Status">
            <div style={{ marginTop: "4px" }}>
              {evacuationRequired ? (
                <ImpactBadge level="HIGH" />
              ) : (
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    color: "#22c55e",
                  }}
                >
                  Not Required
                </span>
              )}
            </div>
          </MetricCell>
        </div>
      </Card>

      {/* ── 4. IMPACT OVERVIEW ───────────────────────────────── */}
      {(trafficImpact || medicalAccessImpact) && (
        <Card style={{ marginBottom: "20px" }}>
          <CardHeading icon={FaCar} label="Impact Overview" iconColor="#f59e0b" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            {trafficImpact && (
              <div
                style={{
                  backgroundColor: "var(--swarm-surface-secondary)",
                  border: "1px solid var(--swarm-border)",
                  borderRadius: "10px",
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--swarm-text-muted)",
                    marginBottom: "8px",
                  }}
                >
                  <FaCar />
                  Traffic Impact
                </div>
                <ImpactBadge level={trafficImpact} />
              </div>
            )}
            {medicalAccessImpact && (
              <div
                style={{
                  backgroundColor: "var(--swarm-surface-secondary)",
                  border: "1px solid var(--swarm-border)",
                  borderRadius: "10px",
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--swarm-text-muted)",
                    marginBottom: "8px",
                  }}
                >
                  <FaHospital />
                  Medical Access Impact
                </div>
                <ImpactBadge level={medicalAccessImpact} />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── 5. IMAGE VALIDATION ──────────────────────────────── */}
      {totalImages > 0 && (
        <Card style={{ marginBottom: "20px" }}>
          <CardHeading icon={FaImage} label="Image Validation" iconColor="#3b82f6" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            {[
              { label: "Submitted", value: totalImages, color: "#64748b" },
              { label: "Accepted", value: validImages, color: "#22c55e" },
              { label: "Rejected", value: rejectedImages, color: "#ef4444" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  backgroundColor: "var(--swarm-surface-secondary)",
                  border: "1px solid var(--swarm-border)",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "1.6rem",
                    fontWeight: 800,
                    color,
                    lineHeight: 1,
                  }}
                >
                  {value}
                </div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--swarm-text-muted)",
                    marginTop: "4px",
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
          {/* Stacked bar */}
          {totalImages > 0 && (
            <div
              style={{
                height: "8px",
                borderRadius: "9999px",
                backgroundColor: "var(--swarm-border)",
                overflow: "hidden",
                display: "flex",
              }}
            >
              {validImages > 0 && (
                <div
                  style={{
                    width: `${(validImages / totalImages) * 100}%`,
                    backgroundColor: "#22c55e",
                    height: "100%",
                    borderRadius: rejectedImages === 0 ? "9999px" : "9999px 0 0 9999px",
                    transition: "width 0.8s ease",
                  }}
                />
              )}
              {rejectedImages > 0 && (
                <div
                  style={{
                    width: `${(rejectedImages / totalImages) * 100}%`,
                    backgroundColor: "#ef4444",
                    height: "100%",
                    borderRadius: validImages === 0 ? "9999px" : "0 9999px 9999px 0",
                    transition: "width 0.8s ease",
                  }}
                />
              )}
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: "16px",
              marginTop: "8px",
              fontSize: "0.72rem",
              color: "var(--swarm-text-muted)",
            }}
          >
            <span>
              <span style={{ color: "#22c55e", fontWeight: 700 }}>■</span> Accepted
            </span>
            <span>
              <span style={{ color: "#ef4444", fontWeight: 700 }}>■</span> Rejected
            </span>
          </div>
        </Card>
      )}

      {/* ── 6. HAZARDS & 7. INFRASTRUCTURE ──────────────────── */}
      {(hazards.length > 0 || infrastructureDmg.length > 0) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: hazards.length > 0 && infrastructureDmg.length > 0
              ? "repeat(auto-fit, minmax(260px, 1fr))"
              : "1fr",
            gap: "20px",
            marginBottom: "20px",
          }}
        >
          {hazards.length > 0 && (
            <Card>
              <CardHeading icon={FaExclamationTriangle} label="Detected Hazards" iconColor="#ef4444" />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {hazards.map((h, i) => (
                  <Tag key={i} danger>{h}</Tag>
                ))}
              </div>
            </Card>
          )}
          {infrastructureDmg.length > 0 && (
            <Card>
              <CardHeading icon={FaShieldAlt} label="Infrastructure Damage" iconColor="#f59e0b" />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {infrastructureDmg.map((d, i) => (
                  <Tag key={i}>{d}</Tag>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── 8. OBSERVATIONS ──────────────────────────────────── */}
      {observations.length > 0 && (
        <Card style={{ marginBottom: "20px" }}>
          <CardHeading icon={FaShieldAlt} label="Field Observations" iconColor="#64748b" />
          <ul
            style={{
              margin: 0,
              paddingLeft: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "5px",
            }}
          >
            {observations.map((obs, i) => (
              <li
                key={i}
                style={{
                  fontSize: "0.875rem",
                  color: "var(--swarm-text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                {obs}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── AGENT RESPONSES ──────────────────────────────────── */}
      {(emergencyRec || medicalRec || resourceRec || routeStatus || hasRoute) && (
        <Card style={{ marginBottom: "20px" }}>
          <CardHeading icon={FaShieldAlt} label="AI Agent Recommendations" iconColor="#dc2626" />
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <AgentCard
              icon={FaExclamationTriangle}
              label="Emergency Response"
              text={emergencyRec}
              iconColor="#ef4444"
            />
            <AgentCard
              icon={FaFirstAid}
              label="Medical Response"
              text={medicalRec}
              iconColor="#38bdf8"
            />
            <AgentCard
              icon={FaBoxes}
              label="Resource Allocation"
              text={resourceRec}
              iconColor="#f59e0b"
            />

            {/* Route waypoints  — only real data, no fabrication */}
            {hasRoute && (
              <div
                style={{
                  backgroundColor: "var(--swarm-surface-secondary)",
                  border: "1px solid var(--swarm-border)",
                  borderRadius: "10px",
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#22d3ee",
                    marginBottom: "10px",
                  }}
                >
                  <FaRoute />
                  Emergency Route Waypoints
                  {routeStatus && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontWeight: 600,
                        fontSize: "0.68rem",
                        color: "var(--swarm-text-muted)",
                        textTransform: "none",
                        letterSpacing: 0,
                      }}
                    >
                      {routeStatus}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {best_route.map((sector, idx) => (
                    <span key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: "6px",
                          backgroundColor: "var(--swarm-surface)",
                          border: "1px solid var(--swarm-border-strong)",
                          color: "#22d3ee",
                          fontSize: "0.78rem",
                          fontFamily: "monospace",
                          fontWeight: 600,
                        }}
                      >
                        {sector}
                      </span>
                      {idx < best_route.length - 1 && (
                        <span style={{ color: "var(--swarm-text-faint)", fontSize: "0.9rem" }}>→</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── 9. MAP ACTION & RESET ────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "12px",
          paddingTop: "8px",
        }}
      >
        {onViewMap && (
          <button
            type="button"
            onClick={onViewMap}
            style={{
              padding: "12px 28px",
              borderRadius: "10px",
              backgroundColor: "#dc2626",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "0.9rem",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "background-color 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#b91c1c"; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#dc2626"; }}
          >
            <FaMap />
            View Interactive Response Map
          </button>
        )}

        <button
          type="button"
          onClick={onReset}
          style={{
            padding: "12px 28px",
            borderRadius: "10px",
            backgroundColor: "var(--swarm-surface-secondary)",
            color: "var(--swarm-text-secondary)",
            fontWeight: 600,
            fontSize: "0.9rem",
            border: "1px solid var(--swarm-border-strong)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--swarm-border)"; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "var(--swarm-surface-secondary)"; }}
        >
          <FaRedo style={{ fontSize: "0.8rem" }} />
          Report Another Incident
        </button>
      </div>
    </div>
  );
}