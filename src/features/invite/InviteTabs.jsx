export default function InviteTabs({ tabs, activeTab, onChange, className = "" }) {
  if (!tabs?.length) return null;
  return (
    <nav className={`flex flex-wrap gap-2 border-b border-gray-100 bg-white px-4 py-3 text-sm font-semibold text-gray-600 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-full px-4 py-1.5 transition ${
              isActive
                ? "bg-emerald-600 text-white shadow"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
