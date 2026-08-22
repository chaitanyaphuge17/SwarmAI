import React from "react";
import { motion } from "framer-motion";
import { FaArrowRight, FaShieldAlt, FaRoute, FaDatabase } from "react-icons/fa";

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
      y: 16,
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
    <div className="min-h-screen w-full bg-[#F8FAFC] text-slate-900 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden">
      {/* Atmosphere Background Gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[580px] h-[580px] rounded-full bg-blue-100/60 opacity-60 blur-3xl" />
        <div className="absolute -bottom-48 -right-48 w-[640px] h-[640px] rounded-full bg-indigo-100/60 opacity-60 blur-3xl" />
      </div>

      {/* Main Layout */}
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative z-10 w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-14 flex-1 my-auto"
      >
        {/* LEFT SIDE — TEXT & HERO */}
        <div className="w-full lg:w-1/2 text-center lg:text-left">
          {/* Logo */}
          <motion.div
            variants={itemVariants}
            className="mb-6 flex items-center justify-center lg:justify-start"
          >
            <motion.img
              src="/src/assets/logo.png"
              alt="SwarmAI"
              className="w-20 h-20 sm:w-24 sm:h-24 object-contain filter drop-shadow-md"
              initial={{ opacity: 0, scale: 0.92 }}
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
            className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-none"
          >
            SwarmAI
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-lg sm:text-xl font-bold text-blue-600 tracking-wide mt-3"
          >
            Autonomous Disaster Decision Intelligence
          </motion.p>

          {/* Description */}
          <motion.p
            variants={itemVariants}
            className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mt-4 font-normal"
          >
            SwarmAI analyzes disaster events, combines coordinated AI decision-making with historical disaster memory, and produces actionable emergency response recommendations.
          </motion.p>

          {/* Capability Cards */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mt-8 text-left"
          >
            {/* Assessment */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col gap-3.5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 group">
              <div className="w-fit p-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 group-hover:scale-105 transition-transform">
                <FaShieldAlt className="text-lg" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  Assessment
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed font-medium">
                  Visual & impact analysis
                </p>
              </div>
            </div>

            {/* Response Plan */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col gap-3.5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 group">
              <div className="w-fit p-3 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:scale-105 transition-transform">
                <FaRoute className="text-lg" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  Response Plan
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed font-medium">
                  Routing & resources
                </p>
              </div>
            </div>

            {/* Memory */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col gap-3.5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 group">
              <div className="w-fit p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:scale-105 transition-transform">
                <FaDatabase className="text-lg" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  Memory
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed font-medium">
                  Historical correlation
                </p>
              </div>
            </div>
          </motion.div>

          {/* Primary BEGIN Action */}
          <motion.div variants={itemVariants} className="mt-10">
            <motion.button
              type="button"
              onClick={onBegin}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary px-10 py-4 text-base tracking-wide font-extrabold shadow-lg shadow-blue-500/25 flex items-center gap-3 cursor-pointer"
            >
              <span>BEGIN INCIDENT REPORT</span>
              <FaArrowRight className="text-sm" />
            </motion.button>
          </motion.div>
        </div>
      </motion.main>
    </div>
  );
}