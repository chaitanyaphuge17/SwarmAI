import { FaRobot, FaUserShield, FaSignOutAlt } from "react-icons/fa";
import { useEffect, useState } from "react";

export default function Navbar({ isAdminAuthenticated = false, onLogout = null, onHome = null }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/85 border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between">
        {/* Left Side Brand */}
        <div
          onClick={onHome}
          className={`flex items-center gap-3.5 ${onHome ? "cursor-pointer group" : ""}`}
        >
          <div className="
            w-10
            h-10
            rounded-xl
            bg-gradient-to-tr
            from-blue-600
            via-indigo-600
            to-blue-700
            text-white
            flex
            items-center
            justify-center
            shadow-md
            shadow-blue-500/25
            transition-transform
            duration-200
            group-hover:scale-105
          ">
            <FaRobot size={20} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">
                SwarmAI
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-[10px] font-bold font-mono uppercase tracking-wider">
                PRO INTEL
              </span>
            </div>

            <p className="text-xs text-slate-500 hidden sm:block font-medium">
              Autonomous Disaster Decision Intelligence
            </p>
          </div>
        </div>

        {/* Right Side Controls & Live Status */}
        <div className="flex items-center gap-5">
          {/* Admin Command Center Badge */}
          {isAdminAuthenticated && (
            <div className="flex items-center gap-2.5 pr-4 border-r border-slate-200">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-mono font-bold shadow-2xs">
                <FaUserShield className="text-xs text-blue-600" />
                COMMAND CENTER
              </span>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title="Log out of Admin Command Center"
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  <FaSignOutAlt className="text-xs" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              )}
            </div>
          )}

          {/* System Live Pill & Clock */}
          <div className="text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-bold">
                System Active
              </p>
            </div>

            <p className="text-xs font-extrabold text-slate-900 font-mono mt-0.5 tracking-tight">
              {time.toLocaleTimeString()}
            </p>

            <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
              {time.toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
}