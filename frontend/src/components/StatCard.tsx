"use client";

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">{title}</h3>
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">{icon}</div>
      </div>
      <p className="text-4xl font-semibold text-gray-900">{value}</p>
      {subtitle && <p className="text-sm text-gray-600 mt-2">{subtitle}</p>}
    </div>
  );
}
