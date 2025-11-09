"use client";

import { useState, useEffect } from "react";

type Analytics = {
  totalSessions: number;
  totalRequests: number;
  avgRating: number;
};

const BACKEND_URL = "http://localhost:4000";

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAnalytics() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/analytics`);
      if (!res.ok) {
        throw new Error("Failed to load analytics");
      }
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load analytics. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
    // Refresh every 5 seconds
    const interval = setInterval(loadAnalytics, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Analytics</h1>
          <p className="text-gray-600">
            Real-time insights into your retail fitting room experience
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border bg-red-50 border-red-200 text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-6 border border-gray-200 animate-pulse shadow-sm"
              >
                <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Sessions */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-lg shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                  Total Sessions
                </h3>
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-4xl font-semibold text-gray-900">
                {analytics?.totalSessions ?? 0}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Active fitting room sessions
              </p>
            </div>

            {/* Total Requests */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-lg shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                  Total Requests
                </h3>
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-4xl font-semibold text-gray-900">
                {analytics?.totalRequests ?? 0}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Size/color change requests
              </p>
            </div>

            {/* Average Rating */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-lg shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                  Average Rating
                </h3>
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-emerald-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-semibold text-gray-900">
                  {analytics?.avgRating.toFixed(1) ?? "0.0"}
                </p>
                <span className="text-gray-600 text-lg">/ 5.0</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Customer satisfaction score
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={loadAnalytics}
            disabled={loading}
            className="px-4 py-2 bg-[#0066CC] hover:bg-[#0052A3] text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
    </div>
  );
}
