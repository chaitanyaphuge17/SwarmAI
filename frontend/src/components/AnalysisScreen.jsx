import { motion, useReducedMotion } from "framer-motion";
import {
  FaMapMarkerAlt,
  FaShieldAlt,
  FaSearch,
  FaChartLine,
  FaHistory,
  FaClipboardList,
  FaSpinner,
} from "react-icons/fa";

export default function AnalysisScreen({ location = "" }) {
  const shouldReduceMotion = useReducedMotion();

  const steps = [
    {
      id: 1,
      title: "Analyzing incident",
      desc: "Evaluating photographic evidence, damage patterns, and visual severity indicators.",
      icon: <FaSearch className="text-blue-600 text-xs" />,
    },
    {
      id: 2,
      title: "Assessing impact",
      desc: "Estimating evacuation necessity, casualty impact, and transport disruption.",
      icon: <FaChartLine className="text-amber-600 text-xs" />,
    },
    {
      id: 3,
      title: "Reviewing historical incidents",
      desc: "Correlating situational data against past disaster precedents in memory.",
      icon: <FaHistory className="text-indigo-600 text-xs" />,
    },
    {
      id: 4,
      title: "Preparing response",
      desc: "Synthesizing actionable emergency guidance, optimal routing, and medical readiness.",
      icon: <FaClipboardList className="text-emerald-600 text-xs" />,
    },
  ];

  const pulseAnimation = shouldReduceMotion
    ? {}
    : {
        scale: [1, 1.06, 1],
        opacity: [0.85, 1, 0.85],
        transition: {
          duration: 2.2,
          repeat: Infinity,
          ease: "easeInOut",
        },
      };

  const ringAnimation = shouldReduceMotion
    ? {}
    : {
        scale: [1, 1.35, 1],
        opacity: [0.35, 0, 0.35],
        transition: {
          duration: 2.2,
          repeat: Infinity,
          ease: "easeOut",
        },
      };

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4">
      {/* Top Processing Emblem & Location */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden shadow-sm">
        {/* Central Pulse Indicator */}
        <div className="relative flex items-center justify-center my-3">
          <motion.div
            animate={ringAnimation}
            className="absolute w-20 h-20 rounded-full border border-blue-400/40"
          />
          <motion.div
            animate={pulseAnimation}
            className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-500 z-10"
          >
            <FaShieldAlt className="text-2xl" />
          </motion.div>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-5">
          SwarmAI Decision Intelligence in Progress
        </h2>

        <p className="text-sm text-gray-500 mt-2 max-w-xl mx-auto">
          Coordinating multi-modal analysis, disaster memory correlation, and emergency response planning.
        </p>

        {/* Incident Target Badge */}
        {location && (
          <div className="inline-flex items-center gap-2 px-4 py-2 mt-5 rounded-full bg-gray-50 border border-gray-200 text-gray-700 text-xs font-mono">
            <FaMapMarkerAlt className="text-red-500" />
            <span className="text-gray-400">Target Location:</span>
            <span className="text-gray-900 font-bold">{location}</span>
          </div>
        )}
      </div>

      {/* Analysis Stages Overview */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 mt-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FaSpinner className="animate-spin text-blue-600 text-sm" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-900">
              Analysis Workflow
            </span>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            Live Execution
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
          {steps.map((step) => (
            <div
              key={step.id}
              className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex items-start gap-3.5"
            >
              <div className="p-2.5 rounded-xl bg-white border border-gray-200 shrink-0 mt-0.5 shadow-2xs">
                {step.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400 font-bold">
                    0{step.id}
                  </span>
                  <h3 className="text-sm font-bold text-gray-900 truncate">
                    {step.title}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            Analysis is processing on the backend. Your actionable disaster response will load automatically upon completion.
          </p>
        </div>
      </div>
    </div>
  );
}
