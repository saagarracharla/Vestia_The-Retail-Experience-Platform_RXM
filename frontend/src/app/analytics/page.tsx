"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Analytics functionality will be available when AWS endpoints are implemented.");

  useEffect(() => {
    // TODO: Implement analytics data fetching when AWS endpoints are available
    console.log("Analytics page loaded - AWS endpoints not yet implemented");
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    // TODO: Implement refresh logic when AWS endpoints are available
    setTimeout(() => {
      setMessage("Analytics data refreshed (stubbed).");
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#F7E9D3]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="rounded-3xl bg-[#FDF6E6] border border-[#E3C89C] shadow-[0_15px_50px_rgba(90,64,34,0.06)] px-8 py-8 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[#3B2A21] mb-4">Analytics Dashboard</h1>
              <p className="text-[#8A623C] text-lg">
                Real-time insights and performance metrics
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-6 py-3 bg-[#8A623C] text-[#FFF7EB] rounded-full font-semibold shadow-lg hover:bg-[#714E2F] disabled:opacity-60"
            >
              {loading ? "Loading..." : "Refresh Data"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Placeholder Analytics Cards */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-[#E3C89C]">
            <h3 className="text-xl font-semibold text-[#3B2A21] mb-2">Total Sessions</h3>
            <p className="text-3xl font-bold text-[#8A623C]">--</p>
            <p className="text-sm text-gray-600 mt-2">Awaiting AWS implementation</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-[#E3C89C]">
            <h3 className="text-xl font-semibold text-[#3B2A21] mb-2">Items Scanned</h3>
            <p className="text-3xl font-bold text-[#8A623C]">--</p>
            <p className="text-sm text-gray-600 mt-2">Awaiting AWS implementation</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-[#E3C89C]">
            <h3 className="text-xl font-semibold text-[#3B2A21] mb-2">Recommendations</h3>
            <p className="text-3xl font-bold text-[#8A623C]">--</p>
            <p className="text-sm text-gray-600 mt-2">Awaiting AWS implementation</p>
          </div>
        </div>

        {message && (
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
