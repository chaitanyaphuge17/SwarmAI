export default function StatsCards({ data }) {
  const stats = data?.stats || {};

  const cards = [
    {
      title: "Severity",
      value: stats.severity ?? "N/A"
    },
    {
      title: "Status",
      value: stats.status || "Active"
    },
    {
      title: "Traffic",
      value: stats.traffic ?? "N/A"
    },
    {
      title: "Active Agents",
      value: stats.activeAgents ?? "N/A"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <div
          key={index}
          className="bg-white border border-gray-200 rounded-2xl shadow-xs p-5 transition-all hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono mb-1.5">
            {card.title}
          </p>

          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            {card.value}
          </h2>
        </div>
      ))}
    </div>
  );
}
