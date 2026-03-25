"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { VestiaAPI, AnalyticsData } from "@/lib/api";

const DAY_OPTIONS = [7, 30, 90] as const;

const STATUS_COLORS: Record<string, { bar: string; badge: string; dot: string }> = {
  DELIVERED: { bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-400" },
  QUEUED:    { bar: "bg-amber-400",   badge: "bg-amber-50 text-amber-800 border-amber-200",     dot: "bg-amber-400" },
  CLAIMED:   { bar: "bg-blue-400",    badge: "bg-blue-50 text-blue-800 border-blue-200",         dot: "bg-blue-400" },
  CANCELLED: { bar: "bg-red-300",     badge: "bg-red-50 text-red-800 border-red-200",             dot: "bg-red-300" },
};

function KPICard({
  label, value, sub, accent = false,
}: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`relative rounded-2xl p-6 border overflow-hidden ${
      accent
        ? "bg-[#4A3A2E] border-[#3B2A21] text-white"
        : "bg-[#FDF7EF] border-[#E5D5C8]"
    }`}>
      {accent && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
      )}
      <p className={`text-xs font-bold uppercase tracking-[0.2em] mb-2 ${accent ? "text-white/60" : "text-[#8C6A4B]"}`}>
        {label}
      </p>
      <p className={`text-4xl font-black tracking-tight ${accent ? "text-white" : "text-[#1C1007]"}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs mt-2 ${accent ? "text-white/50" : "text-[#8C6A4B]"}`}>{sub}</p>
      )}
    </div>
  );
}

function RankBar({ label, count, max, rank }: { label: string; count: number; max: number; rank: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 group">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
        rank === 1 ? "bg-[#C17B3E] text-white" :
        rank === 2 ? "bg-[#8C6A4B] text-white" :
        rank === 3 ? "bg-[#B5A99C] text-white" :
        "bg-[#E5D5C8] text-[#8C6A4B]"
      }`}>{rank}</span>
      <span className="w-28 text-sm text-[#1C1007] font-medium truncate capitalize">{label}</span>
      <div className="flex-1 bg-[#F0E0CC] rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${rank <= 3 ? "bg-[#C17B3E]" : "bg-[#8C6A4B]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-bold text-[#4A3A2E] w-8 text-right">{count}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const fetchAnalytics = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await VestiaAPI.getAnalytics(d);
      setData(result);
    } catch (err) {
      setError("Failed to load analytics. Check your AWS connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(days); }, [days, fetchAnalytics]);

  function fmtDuration(seconds: number) {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  const topItemMax  = data?.topItems[0]?.count  ?? 1;
  const topSizeMax  = data?.topSizes[0]?.count  ?? 1;
  const topColorMax = data?.topColors[0]?.count ?? 1;
  const statusEntries = data ? Object.entries(data.requestStatusBreakdown).sort((a, b) => b[1] - a[1]) : [];
  const totalRequests = statusEntries.reduce((s, [, c]) => s + c, 0);

  return (
    <div className="min-h-screen bg-[#F7EDE0]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Hero Header */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#C17B3E] mb-2">Store STORE-001</p>
            <h1 className="text-5xl font-black text-[#1C1007] leading-none">Analytics</h1>
            {data && (
              <p className="text-[#8C6A4B] mt-2">
                {new Date(data.period.from).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {" — "}
                {new Date(data.period.to).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-[#FDF7EF] p-1 rounded-2xl border border-[#E5D5C8] shadow-sm">
              {DAY_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                    days === d
                      ? "bg-[#4A3A2E] text-[#FDF7EF] shadow-md"
                      : "text-[#8C6A4B] hover:text-[#4A3A2E]"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              onClick={() => fetchAnalytics(days)}
              disabled={loading}
              className="px-5 py-2.5 bg-[#4A3A2E] hover:bg-[#3B2A21] text-[#FDF7EF] rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-medium">
            ✕ {error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-[#E5D5C8] border-t-[#4A3A2E] rounded-full animate-spin" />
          </div>
        ) : data ? (
          <>
            {/* KPI Grid — 6 cards, fulfillment gets accent */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
              <KPICard label="Sessions"         value={data.totalSessions} />
              <KPICard label="Items Scanned"    value={data.totalScans} />
              <KPICard label="Requests"         value={data.totalRequests} />
              <KPICard label="Items / Session"  value={data.avgItemsPerSession} />
              <KPICard label="Avg Session"      value={fmtDuration(data.avgSessionDurationSeconds)} />
              <KPICard label="Fulfillment"      value={`${data.requestFulfillmentRate}%`} sub={`avg ${fmtDuration(data.avgFulfillmentSeconds)}`} accent />
            </div>

            {/* Request Status — donut-style breakdown */}
            {statusEntries.length > 0 && (
              <div className="bg-[#FDF7EF] rounded-3xl border border-[#E5D5C8] p-7 mb-8 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8C6A4B] mb-5">Request Status Breakdown</p>
                <div className="flex flex-wrap gap-3">
                  {statusEntries.map(([status, count]) => {
                    const cfg = STATUS_COLORS[status] ?? { badge: "bg-[#F5E9DA] text-[#4A3A2E] border-[#E5D5C8]", dot: "bg-[#8C6A4B]" };
                    const pct = totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0;
                    return (
                      <div key={status} className={`flex items-center gap-3 px-5 py-3 rounded-2xl border font-medium ${cfg.badge}`}>
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                        <span className="text-2xl font-black">{count}</span>
                        <div className="leading-tight">
                          <p className="text-xs font-bold uppercase tracking-wide">{status}</p>
                          <p className="text-xs opacity-70">{pct}% of total</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Three charts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Top Scanned Items */}
              <div className="bg-[#FDF7EF] rounded-3xl border border-[#E5D5C8] p-7 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8C6A4B] mb-1">Top Scanned Items</p>
                <p className="text-2xl font-black text-[#1C1007] mb-5">SKUs</p>
                {data.topItems.length === 0 ? (
                  <p className="text-sm text-[#8C6A4B]">No scan data yet</p>
                ) : (
                  <div className="space-y-4">
                    {data.topItems.map(({ sku, count }, i) => (
                      <RankBar key={sku} label={`SKU ${sku}`} count={count} max={topItemMax} rank={i + 1} />
                    ))}
                  </div>
                )}
              </div>

              {/* Most Requested Sizes */}
              <div className="bg-[#FDF7EF] rounded-3xl border border-[#E5D5C8] p-7 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8C6A4B] mb-1">Most Requested</p>
                <p className="text-2xl font-black text-[#1C1007] mb-5">Sizes</p>
                {data.topSizes.length === 0 ? (
                  <p className="text-sm text-[#8C6A4B]">No size requests yet</p>
                ) : (
                  <div className="space-y-4">
                    {data.topSizes.map(({ size, count }, i) => (
                      <RankBar key={size} label={size} count={count} max={topSizeMax} rank={i + 1} />
                    ))}
                  </div>
                )}
              </div>

              {/* Most Requested Colors */}
              <div className="bg-[#FDF7EF] rounded-3xl border border-[#E5D5C8] p-7 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8C6A4B] mb-1">Most Requested</p>
                <p className="text-2xl font-black text-[#1C1007] mb-5">Colors</p>
                {data.topColors.length === 0 ? (
                  <p className="text-sm text-[#8C6A4B]">No color requests yet</p>
                ) : (
                  <div className="space-y-4">
                    {data.topColors.map(({ color, count }, i) => (
                      <RankBar key={color} label={color} count={count} max={topColorMax} rank={i + 1} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
