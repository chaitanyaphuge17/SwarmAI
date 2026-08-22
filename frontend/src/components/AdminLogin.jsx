import { useState } from "react";
import { motion } from "framer-motion";
import {
  FaShieldAlt,
  FaLock,
  FaUser,
  FaEye,
  FaEyeSlash,
  FaArrowRight,
  FaSpinner,
  FaExclamationTriangle,
  FaChevronLeft,
} from "react-icons/fa";
import { loginAdmin } from "../services/adminService";

export default function AdminLogin({ onLoginSuccess, onBackToCitizen }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username.trim()) {
      setError("Please enter your administrator username.");
      return;
    }
    if (!password) {
      setError("Please enter your administrator password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await loginAdmin(username.trim(), password);
      if (data?.success) {
        onLoginSuccess(data.username || username);
      } else {
        setError(data?.message || "Authentication failed. Access denied.");
      }
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        "Invalid username or password. Please verify your credentials.";
      setError(typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-white border border-gray-200 rounded-3xl p-8 shadow-sm relative overflow-hidden"
      >
        {/* Back Link */}
        {onBackToCitizen && (
          <button
            type="button"
            onClick={onBackToCitizen}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition font-mono uppercase tracking-wider mb-6 cursor-pointer"
          >
            <FaChevronLeft className="text-[10px]" />
            Return to Citizen Portal
          </button>
        )}

        {/* Emblem & Title */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 border border-blue-500 mb-4">
            <FaShieldAlt className="text-2xl" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Emergency Command Portal
          </h2>
          <p className="text-xs text-gray-400 font-mono uppercase tracking-widest mt-1">
            Authorized Personnel Only
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-3"
          >
            <FaExclamationTriangle className="text-sm shrink-0 mt-0.5" />
            <p className="font-medium">{error}</p>
          </motion.div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-gray-600 flex items-center gap-1.5 font-semibold">
              <FaUser className="text-[10px] text-blue-600" /> Administrator ID
            </label>
            <div className="relative">
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                placeholder="e.g. admin"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15 transition"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-gray-600 flex items-center gap-1.5 font-semibold">
              <FaLock className="text-[10px] text-blue-600" /> Security Key / Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 pr-11 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition text-sm cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm tracking-wide shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin text-sm" />
                <span>Authenticating…</span>
              </>
            ) : (
              <>
                <span>Access Command Center</span>
                <FaArrowRight className="text-xs" />
              </>
            )}
          </button>
        </form>

        {/* Security Notice */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-[11px] text-gray-400 font-mono leading-relaxed">
            Restricted access. All connection attempts, IP addresses, and command operations are cryptographically logged.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
