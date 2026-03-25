"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { VestiaAPI, AnalyticsData } from "@/lib/api";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E3C89C] flex flex-col gap-1">
      <p className="text-sm font-medium text-[#8A623C] uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-[#3B2A21]">{value}</p>
      {sub && <p className="text-xs text-[#8A623C] mt-1">{sub}</p>}
    </div>
  );
}

function MiniBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-sm text-[#3B2A21] font-medium truncate capitalize">{label}</span>
      <div className="flex-1 bg-[#F0E0C8] rounded-full h-2.5 overflow-hidden">
        <div
          className="h-full bg-[#8A623C] rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm text-[#3B2A21] font-semibold w-8 text-right">{count}</span>
    </div>
  );
}

const DAY_OPTIONS = [7, 30, 90] as const;

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
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(days);
  }, [days, fetchAnalytics]);

  function fmtDuration(seconds: number) {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  const topItemMax = data?.topItems[0]?.count ?? 1;
  const topSizeMax = data?.topSizes[0]?.count ?? 1;
  const topColorMax = data?.topColors[0]?.count ?? 1;

  const statusEntries = data
    ? Object.entries(data.requestStatusBreakdown).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="min-h-screen bg-[#F7E9D3]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="rounded-3xl bg-[#FDF6E6] border border-[#E3C89C] shadow-sm px-8 py-8 mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold text-[#3B2A21] mb-1">Store Analytics</h1>
            <p className="text-[#8A623C]">
              {data
                ? `${data.period.days}-day window · Last updated ${new Date().toLocaleTimeString()}`
                : "Loading…"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Period selector */}
            <div className="flex gap-1 bg-[#F0E0C8] p-1 rounded-full">
              {DAY_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                    days === d
                      ? "bg-[#8A623C] text-white shadow"
                      : "text-[#8A623C] hover:bg-white/60"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              onClick={() => fetchAnalytics(days)}
              disabled={loading}
              className="px-5 py-2.5 bg-[#8A623C] text-white rounded-full font-semibold text-sm shadow hover:bg-[#714E2F] disabled:opacity-50 transition-all"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-[#E3C89C] border-t-[#8A623C] rounded-full animate-spin" />
          </div>
        ) : data ? (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <StatCard label="Sessions" value={data.totalSessions} />
              <StatCard label="Items Scanned" value={data.totalScans} />
              <StatCard label="Requests" value={data.totalRequests} />
              <StatCard
                label="Avg Items/Session"
                value={data.avgItemsPerSession}
              />
              <StatCard
                label="Avg Session"
                value={fmtDuration(data.avgSessionDurationSeconds)}
              />
              <StatCard
                label="Fulfillment Rate"
                value={`${data.requestFulfillmentRate}%`}
                sub={`Avg ${fmtDuration(data.avgFulfillmentSeconds)} per request`}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

              {/* Top Items */}
              <div className="bg-white rounded-2xl p-6 border border-[#E3C89C] shadow-sm">
                <h3 className="text-lg font-bold text-[#3B2A21] mb-4">Top Scanned Items</h3>
                {data.topItems.length === 0 ? (
                  <p className="text-sm text-[#8A623C]">No scan data yet</p>
                ) : (
                  <div className="space-y-3">
                    {data.topItems.map(({ sku, count }) => (
                      <MiniBar key={sku} label={`SKU ${sku}`} count={count} max={topItemMax} />
                    ))}
                  </div>
                )}
              </div>

              {/* Top Sizes */}
              <div className="bg-white rounded-2xl p-6 border border-[#E3C89C] shadow-sm">
                <h3 className="text-lg font-bold text-[#3B2A21] mb-4">Most Requested Sizes</h3>
                {data.topSizes.length === 0 ? (
                  <p className="text-sm text-[#8A623C]">No size requests yet</p>
                ) : (
                  <div className="space-y-3">
                    {data.topSizes.map(({ size, count }) => (
                      <MiniBar key={size} label={size} count={count} max={topSizeMax} />
                    ))}
                  </div>
                )}
              </div>

              {/* Top Colors */}
              <div className="bg-white rounded-2xl p-6 border border-[#E3C89C] shadow-sm">
                <h3 className="text-lg font-bold text-[#3B2A21] mb-4">Most Requested Colors</h3>
                {data.topColors.length === 0 ? (
                  <p className="text-sm text-[#8A623C]">No color requests yet</p>
                ) : (
                  <div className="space-y-3">
                    {data.topColors.map(({ color, count }) => (
                      <MiniBar key={color} label={color} count={count} max={topColorMax} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Request Status Breakdown */}
            {statusEntries.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-[#E3C89C] shadow-sm mb-8">
                <h3 className="text-lg font-bold text-[#3B2A21] mb-4">Request Status Breakdown</h3>
                <div className="flex flex-wrap gap-4">
                  {statusEntries.map(([status, count]) => {
                    const colors: Record<string, string> = {
                      DELIVERED: "bg-emerald-100 text-emerald-800 border-emerald-200",
                      QUEUED: "bg-amber-100 text-amber-800 border-amber-200",
                      CLAIMED: "bg-blue-100 text-blue-800 border-blue-200",
                      CANCELLED: "bg-red-100 text-red-800 border-red-200",
                    };
                    const cls = colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
                    return (
                      <div key={status} className={`px-5 py-3 rounded-xl border font-medium text-sm ${cls}`}>
                        <span className="font-bold text-lg mr-2">{count}</span>
                        {status}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
