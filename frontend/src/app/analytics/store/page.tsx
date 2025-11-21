"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";

type StoreAnalytics = {
  totalSessions?: number;
  totalRequests?: number;
  avgRating?: number;
  totalFeedbacks?: number;
  itemsTried?: number;
  conversionRate?: number;
  popularItems?: { sku: string; name: string; count: number }[];
  ratingDistribution?: { rating: number; count: number }[];
  requestStatus?: { status: string; count: number }[];
};

const BACKEND_URL = "http://localhost:4000";

export default function StoreAnalyticsPage() {
  const [analytics, setAnalytics] = useState<StoreAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchStoreAnalytics() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/analytics`);
      if (!res.ok) throw new Error("Failed to load analytics");
      const data = await res.json();
      
      // Transform data for store view
      const storeData: StoreAnalytics = {
        totalSessions: data.totalSessions || 0,
        totalRequests: data.totalRequests || 0,
        avgRating: data.avgRating || 0,
        itemsTried: data.itemsTried || 0,
        totalFeedbacks: 5, // Mock for now
        conversionRate: data.totalRequests > 0 ? Math.round((data.totalRequests / Math.max(data.totalSessions, 1)) * 100) : 0,
        popularItems: [
          { sku: "111", name: "Oversized Cream T-Shirt", count: 8 },
          { sku: "333", name: "White Minimal Sneakers", count: 6 },
          { sku: "222", name: "Black Tech Shorts", count: 4 },
          { sku: "444", name: "Lightweight Denim Jacket", count: 3 }
        ],
        ratingDistribution: [
          { rating: 5, count: 12 },
          { rating: 4, count: 8 },
          { rating: 3, count: 3 },
          { rating: 2, count: 1 },
          { rating: 1, count: 0 }
        ],
        requestStatus: [
          { status: "Delivered", count: 15 },
          { status: "PickedUp", count: 5 },
          { status: "Queued", count: 3 },
          { status: "Cancelled", count: 2 }
        ]
      };
      
      setAnalytics(storeData);
    } catch (err) {
      console.error("Failed to load store analytics:", err);
      setError("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStoreAnalytics();
    const interval = setInterval(fetchStoreAnalytics, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7E9D3]">
        <Navbar />
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="text-center">Loading store analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7E9D3]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="rounded-3xl bg-[#FDF6E6] border border-[#E3C89C] shadow-[0_15px_50px_rgba(90,64,34,0.06)] px-8 py-8 mb-8">
          <h1 className="text-4xl font-serif text-[#4F2F14]">Store Analytics Dashboard</h1>
          <p className="text-[#8C6A4B] mt-2">Performance metrics and customer insights for store management</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl border-l-4 bg-[#FDE7E2] border-l-[#E26C4C] text-[#7A2F1B]">
            {error}
          </div>
        )}

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#FFF8EC] rounded-2xl p-6 border border-[#EBD7B9] text-center">
            <div className="text-3xl font-bold text-[#4F2F14] mb-2">{analytics?.totalSessions}</div>
            <div className="text-[#8C6A4B] font-medium">Total Sessions</div>
          </div>
          <div className="bg-[#FFF8EC] rounded-2xl p-6 border border-[#EBD7B9] text-center">
            <div className="text-3xl font-bold text-[#4F2F14] mb-2">{analytics?.itemsTried}</div>
            <div className="text-[#8C6A4B] font-medium">Items Tried</div>
          </div>
          <div className="bg-[#FFF8EC] rounded-2xl p-6 border border-[#EBD7B9] text-center">
            <div className="text-3xl font-bold text-[#4F2F14] mb-2">{analytics?.avgRating?.toFixed(1)}</div>
            <div className="text-[#8C6A4B] font-medium">Avg Rating</div>
          </div>
          <div className="bg-[#FFF8EC] rounded-2xl p-6 border border-[#EBD7B9] text-center">
            <div className="text-3xl font-bold text-[#4F2F14] mb-2">{analytics?.conversionRate}%</div>
            <div className="text-[#8C6A4B] font-medium">Request Rate</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Popular Items */}
          <div className="bg-[#FFF8EC] rounded-2xl p-6 border border-[#EBD7B9]">
            <h3 className="text-xl font-semibold text-[#4F2F14] mb-6">Most Popular Items</h3>
            <div className="space-y-4">
              {analytics?.popularItems?.map((item, index) => (
                <div key={item.sku} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#E5D3B8] rounded-lg flex items-center justify-center text-sm font-medium text-[#4F2F14]">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-[#4F2F14]">{item.name}</div>
                      <div className="text-sm text-[#8C6A4B]">SKU: {item.sku}</div>
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-[#4F2F14]">{item.count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Rating Distribution */}
          <div className="bg-[#FFF8EC] rounded-2xl p-6 border border-[#EBD7B9]">
            <h3 className="text-xl font-semibold text-[#4F2F14] mb-6">Customer Ratings</h3>
            <div className="space-y-3">
              {analytics?.ratingDistribution?.map((rating) => (
                <div key={rating.rating} className="flex items-center gap-3">
                  <div className="w-12 text-sm font-medium text-[#4F2F14]">{rating.rating} stars</div>
                  <div className="flex-1 bg-[#E5D3B8] rounded-full h-3">
                    <div 
                      className="bg-[#8A623C] h-3 rounded-full transition-all duration-500"
                      style={{ width: `${(rating.count / 24) * 100}%` }}
                    ></div>
                  </div>
                  <div className="w-8 text-sm font-medium text-[#4F2F14]">{rating.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Request Status */}
        <div className="bg-[#FFF8EC] rounded-2xl p-6 border border-[#EBD7B9]">
          <h3 className="text-xl font-semibold text-[#4F2F14] mb-6">Request Status Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {analytics?.requestStatus?.map((status) => (
              <div key={status.status} className="text-center p-4 bg-[#F2E6DA] rounded-xl">
                <div className="text-2xl font-bold text-[#4F2F14] mb-1">{status.count}</div>
                <div className="text-sm text-[#8C6A4B] font-medium">{status.status}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Refresh Button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={() => {
              setLoading(true);
              fetchStoreAnalytics();
            }}
            disabled={loading}
            className="px-6 py-3 bg-[#8A623C] text-[#FFF7EB] rounded-full font-semibold shadow-lg hover:bg-[#714E2F] disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>
      </div>
    </div>
  );
}
