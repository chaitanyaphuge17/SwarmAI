import { motion } from "framer-motion";
import {
  FaArrowRight,
  FaShieldAlt,
  FaRoute,
  FaDatabase,
  FaAmbulance,
  FaMapMarkerAlt,
  FaExclamationTriangle,
} from "react-icons/fa";

export default function WelcomeScreen({ onBegin }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      y: -12,
      transition: {
        duration: 0.3,
        ease: "easeInOut",
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 14,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <div className="min-h-screen w-full bg-[#F6F7F9] text-[#172033] flex flex-col justify-between p-3 sm:p-5 relative overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">

        {/* Soft neutral atmosphere */}
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-[#E8EDF3] opacity-45 blur-3xl" />

        <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] rounded-full bg-[#EEF1F4] opacity-65 blur-3xl" />

        {/* Subtle map contour */}
        <div className="absolute inset-0 opacity-[0.10]">
          <svg
            className="w-full h-full"
            viewBox="0 0 1200 800"
            preserveAspectRatio="none"
          >
            <path
              d="M0 180 C180 80 300 250 470 150 S760 80 920 190 S1080 270 1200 150"
              fill="none"
              stroke="#94A3B8"
              strokeWidth="1"
            />

            <path
              d="M0 620 C180 520 300 690 470 590 S760 520 920 630 S1080 710 1200 590"
              fill="none"
              stroke="#94A3B8"
              strokeWidth="1"
            />
          </svg>
        </div>
      </div>

      {/* Main Layout */}
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative z-10 w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-12 flex-1 min-h-0"
      >

        {/* LEFT SIDE — TEXT */}
        <div className="w-full lg:w-1/2 text-center lg:text-left">

          {/* Logo */}
          <motion.div
            variants={itemVariants}
            className="mb-5 flex items-center justify-center lg:justify-start"
          >
            <motion.img
              src="/src/assets/logo.png"
              alt="SwarmAI"
              className="w-20 h-20 sm:w-24 sm:h-24 object-contain"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          </motion.div>

          {/* Title */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-6xl font-extrabold text-[#111827] tracking-tight leading-none"
          >
            SwarmAI
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-lg sm:text-xl font-medium text-[#334155] tracking-wide mt-4"
          >
            Autonomous Disaster Decision Intelligence
          </motion.p>

          {/* Description */}
          <motion.p
            variants={itemVariants}
            className="text-base sm:text-lg text-[#475569] leading-relaxed max-w-xl mt-6"
          >
            SwarmAI analyzes disaster events, combines coordinated AI
            decision-making with historical disaster memory, and produces
            actionable emergency response recommendations.
          </motion.p>

          {/* Capability Cards */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl mt-8 text-left"
          >

            {/* Assessment */}
            <div className="bg-white/95 border border-[#D5DAE1] rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="w-fit p-2.5 rounded-lg bg-[#FBEAEA] text-[#B42318]">
                <FaShieldAlt className="text-sm" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#334155]">
                  Assessment
                </p>

                <p className="text-xs text-[#526174] mt-1 leading-relaxed">
                  Visual & impact analysis
                </p>
              </div>
            </div>

            {/* Response Plan */}
            <div className="bg-white/95 border border-[#D5DAE1] rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="w-fit p-2.5 rounded-lg bg-[#EAF1F5] text-[#3F647D]">
                <FaRoute className="text-sm" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#334155]">
                  Response Plan
                </p>

                <p className="text-xs text-[#526174] mt-1 leading-relaxed">
                  Routing & resources
                </p>
              </div>
            </div>

            {/* Memory */}
            <div className="bg-white/95 border border-[#D5DAE1] rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="w-fit p-2.5 rounded-lg bg-[#F2F3F5] text-[#596575]">
                <FaDatabase className="text-sm" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#334155]">
                  Memory
                </p>

                <p className="text-xs text-[#526174] mt-1 leading-relaxed">
                  Historical correlation
                </p>
              </div>
            </div>

          </motion.div>

          {/* BEGIN */}
          <motion.div
            variants={itemVariants}
            className="mt-8 flex justify-center lg:justify-start"
          >
            <motion.button
              type="button"
              onClick={onBegin}
              whileHover={{
                scale: 1.02,
                y: -1,
              }}
              whileTap={{
                scale: 0.98,
              }}
              className="px-9 py-3.5 bg-[#B42318] hover:bg-[#981B12] text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-3 text-base tracking-wide cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#B42318]/30 focus:ring-offset-2 focus:ring-offset-[#F6F7F9]"
            >
              <span>BEGIN</span>
              <FaArrowRight className="text-sm" />
            </motion.button>
          </motion.div>
        </div>

        {/* RIGHT SIDE — EMERGENCY RESPONSE ANIMATION */}
        <motion.div
          variants={itemVariants}
          className="w-full lg:w-1/2 flex items-center justify-center"
        >
          <div className="relative w-full max-w-[520px] h-[400px]">

            {/* Map panel */}
            <div className="absolute inset-0 rounded-3xl border border-[#D5DAE1] bg-white/60 backdrop-blur-sm shadow-sm overflow-hidden">

              {/* Map grid */}
              <div
                className="absolute inset-0 opacity-[0.35]"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, #CBD5E1 1px, transparent 1px),
                    linear-gradient(to bottom, #CBD5E1 1px, transparent 1px)
                  `,
                  backgroundSize: "40px 40px",
                }}
              />

              {/* Decorative roads */}
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 520 400"
                preserveAspectRatio="none"
              >
                <path
                  d="M20 300 C100 250 130 320 190 260 S300 150 350 210 S430 260 500 160"
                  fill="none"
                  stroke="#CBD5E1"
                  strokeWidth="18"
                  strokeLinecap="round"
                  opacity="0.65"
                />

                <path
                  d="M20 300 C100 250 130 320 190 260 S300 150 350 210 S430 260 500 160"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="11"
                  strokeLinecap="round"
                />

                {/* Emergency route */}
                <motion.path
                  d="M75 290 C140 275 160 285 205 255 S270 205 325 215 S375 225 425 165"
                  fill="none"
                  stroke="#B42318"
                  strokeWidth="3"
                  strokeDasharray="8 8"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: 1,
                    opacity: 0.8,
                  }}
                  transition={{
                    duration: 1.5,
                    delay: 0.5,
                    ease: "easeInOut",
                  }}
                />
              </svg>

              {/* Incident area */}
              <motion.div
                className="absolute right-[14%] top-[28%] flex items-center justify-center"
                animate={{
                  scale: [1, 1.08, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {/* Pulse */}
                <motion.div
                  className="absolute w-20 h-20 rounded-full border border-[#B42318]/30"
                  animate={{
                    scale: [0.7, 1.5],
                    opacity: [0.5, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />

                <div className="relative w-11 h-11 rounded-full bg-white border border-[#D5DAE1] shadow-md flex items-center justify-center">
                  <FaExclamationTriangle className="text-[#B42318] text-lg" />
                </div>
              </motion.div>

              {/* Incident label */}
              <div className="absolute right-[8%] top-[47%] bg-white border border-[#D5DAE1] rounded-lg px-3 py-2 shadow-sm">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[#64748B]">
                  Incident
                </p>
                <p className="text-xs font-semibold text-[#1E293B]">
                  Emergency Location
                </p>
              </div>

              {/* Ambulance */}
              <motion.div
                className="absolute left-[8%] top-[63%] z-20"
                animate={{
                  left: ["8%", "25%", "43%", "61%", "77%"],
                  top: ["63%", "65%", "58%", "55%", "39%"],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  repeatDelay: 1.5,
                  ease: "easeInOut",
                }}
              >
                <div className="relative">

                  {/* Vehicle shadow */}
                  <div className="absolute -bottom-1 left-1 w-10 h-2 bg-[#64748B]/20 rounded-full blur-sm" />

                  {/* Ambulance */}
                  <div className="relative w-12 h-8 bg-white border border-[#CBD5E1] rounded-md shadow-md flex items-center justify-center">
                    <div className="absolute left-1 top-1 bottom-1 w-6 rounded-sm bg-[#EEF2F6]" />

                    <div className="absolute right-1 top-1.5 w-4 h-4 rounded-sm bg-[#E2E8F0]" />

                    {/* Red emergency cross */}
                    <div className="relative z-10 w-5 h-5">
                      <div className="absolute left-2 top-0 w-1 h-5 bg-[#B42318]" />
                      <div className="absolute left-0 top-2 w-5 h-1 bg-[#B42318]" />
                    </div>

                    {/* Wheels */}
                    <div className="absolute -bottom-1 left-1.5 w-2.5 h-2.5 rounded-full bg-[#334155]" />
                    <div className="absolute -bottom-1 right-1.5 w-2.5 h-2.5 rounded-full bg-[#334155]" />
                  </div>

                  {/* Small route indicator */}
                  <motion.div
                    className="absolute -top-4 left-1/2 -translate-x-1/2 text-[#B42318]"
                    animate={{
                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                    }}
                  >
                    <FaAmbulance className="text-xs" />
                  </motion.div>
                </div>
              </motion.div>

              {/* Start location */}
              <div className="absolute left-[8%] top-[69%]">
                <div className="flex items-center gap-2 bg-white border border-[#D5DAE1] rounded-lg px-3 py-2 shadow-sm">
                  <FaMapMarkerAlt className="text-[#64748B] text-xs" />
                  <span className="text-[10px] font-medium text-[#64748B]">
                    Response Unit
                  </span>
                </div>
              </div>

              {/* Status */}
              <div className="absolute left-5 top-5 bg-white/90 border border-[#D5DAE1] rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <motion.span
                    className="w-2 h-2 rounded-full bg-[#B42318]"
                    animate={{
                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                    }}
                  />
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#475569]">
                    Response Simulation
                  </span>
                </div>
              </div>

            </div>
          </div>
        </motion.div>

      </motion.main>

      {/* Footer
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: 0.4,
          delay: 0.4,
        }}
        className="relative z-10 w-full max-w-5xl mx-auto text-center border-t border-[#DDE2E8] pt-4 text-xs text-[#8993A1]"
      >
        Emergency Command & Incident Intelligence Platform
      </motion.footer> */}
    </div>
  );
}