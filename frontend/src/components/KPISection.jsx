import {
    FaUsers,
    FaExclamationTriangle,
    FaAmbulance,
    FaRobot,
} from "react-icons/fa";
import { motion } from "framer-motion";

export default function KPISection({ data }) {
    const kpis = [
        {
            title: "Traffic Impact",
            value: data?.disaster?.traffic_impact ?? "Moderate",
            icon: <FaExclamationTriangle />,
            color: "border-l-red-500",
            iconBg: "bg-red-50 text-red-600 border-red-100",
        },
        {
            title: "Severity",
            value: data?.disaster?.severity ?? "--",
            icon: <FaExclamationTriangle />,
            color: "border-l-amber-500",
            iconBg: "bg-amber-50 text-amber-600 border-amber-100",
        },
        {
            title: "Ambulances",
            value:
                data?.map?.ambulances?.length > 0
                    ? data.map.ambulances.length
                    : "--",
            icon: <FaAmbulance />,
            color: "border-l-blue-500",
            iconBg: "bg-blue-50 text-blue-600 border-blue-100",
        },
        {
            title: "AI Agents",
            value:
                data?.agents &&
                    Object.values(data.agents).some(
                        (agent) => agent.response
                    )
                    ? Object.keys(data.agents).length
                    : "--",
            icon: <FaRobot />,
            color: "border-l-emerald-500",
            iconBg: "bg-emerald-50 text-emerald-600 border-emerald-100",
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((item) => (
                <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.3 }}
                    className={`
                        relative overflow-hidden
                        rounded-2xl p-5
                        bg-white
                        border border-gray-200
                        border-l-4 ${item.color}
                        shadow-xs hover:shadow-md
                        transition-all duration-200
                    `}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">
                                {item.title}
                            </p>

                            <h3 className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                                {item.value}
                            </h3>
                        </div>

                        <div
                            className={`
                                flex h-11 w-11 items-center justify-center
                                rounded-xl border
                                ${item.iconBg}
                                text-lg font-bold
                                shadow-2xs
                            `}
                        >
                            {item.icon}
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}