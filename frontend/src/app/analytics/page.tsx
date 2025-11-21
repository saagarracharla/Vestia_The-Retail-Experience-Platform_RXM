"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import ColourDot from "@/components/ColourDot";
import DonutChart from "@/components/DonutChart";
import { ITEMS_BY_SKU } from "@/data/items";

type Analytics = {
  totalSessions?: number;
  totalRequests?: number;
  avgRating?: number;
  itemsTried?: number;
  requestsMade?: number;
  priceRange?: string;
  favouriteMaterial?: string;
  mostSelectedSize?: string;
  colours?: string[];
  outfitCategories?: { name: string; value: number }[];
  activity?: string[];
};

const BACKEND_URL = "http://localhost:4000";

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // session-aware analytics: if a kiosk session is active on this device
  // (kiosk stores `sessionId` in localStorage), poll session endpoints
  // and derive per-session analytics. Otherwise fall back to generic analytics.
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionItems, setSessionItems] = useState<any[]>([]);
  const [sessionRequests, setSessionRequests] = useState<any[]>([]);

  async function fetchGenericAnalytics() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/analytics`);
      if (!res.ok) throw new Error("Failed to load analytics");
      const data = await res.json();
      setAnalytics(data);
      
      // Also get session items for images if we have a sessionId
      const sid = typeof window !== "undefined" ? localStorage.getItem("sessionId") : null;
      if (sid) {
        try {
          const sessionRes = await fetch(`${BACKEND_URL}/api/session/${sid}`);
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            setSessionItems(sessionData.items || []);
          }
        } catch (err) {
          console.warn("Could not fetch session items for images:", err);
        }
      }
    } catch (err) {
      console.warn("Analytics backend missing or failed — using placeholders.", err);
      setAnalytics((prev) =>
        prev ?? {
          totalSessions: 12,
          totalRequests: 3,
          avgRating: 4.6,
          itemsTried: 6,
          requestsMade: 3,
          priceRange: "$45 - $130",
          favouriteMaterial: "Cotton",
          mostSelectedSize: "SM",
          colours: ["#605A9A", "#A47F7F", "#2E7D32"],
          outfitCategories: [
            { name: "Streetwear", value: 60 },
            { name: "Old Money", value: 40 },
          ],
          activity: [
            "Saved beige pants",
            "Requested larger size (lapis blue cardigan)",
            "Checked in beige pants",
            "Checked in lapis blue cardigan",
          ],
        }
      );
    }
  }

  async function fetchSession(sessionId: string) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/session/${sessionId}`);
      if (!res.ok) throw new Error("Failed to load session");
      const data = await res.json();
      setSessionItems(data.items || []);
    } catch (err) {
      console.warn("Failed to fetch session:", err);
    }
  }

  async function fetchRequestsForSession(sessionId: string) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/requests?sessionId=${sessionId}`);
      if (!res.ok) throw new Error("Failed to load requests");
      const data = await res.json();
      setSessionRequests(data || []);
    } catch (err) {
      try {
        const resAll = await fetch(`${BACKEND_URL}/api/requests`);
        if (!resAll.ok) throw new Error("Failed to load requests");
        const all = await resAll.json();
        const filtered = (all || []).filter((r: any) => r.sessionId === sessionId);
        setSessionRequests(filtered);
      } catch (err2) {
        console.warn("Failed to fetch requests:", err2);
      }
    }
  }

  function deriveAnalyticsFromSession(sessionItems: any[], sessionRequests: any[]) {
    const colours = Array.from(new Set(sessionItems.map((i) => i.color).filter(Boolean)));

    const sizeCounts: Record<string, number> = {};
    sessionItems.forEach((i) => {
      if (!i.size) return;
      sizeCounts[i.size] = (sizeCounts[i.size] || 0) + 1;
    });
    const mostSelectedSize = Object.keys(sizeCounts).length
      ? Object.keys(sizeCounts).reduce((a, b) => (sizeCounts[a] > sizeCounts[b] ? a : b))
      : "—";

    const categories: Record<string, number> = {};
    sessionItems.forEach((i) => {
      const name: string = i.name || "Other";
      if (/jean|denim|pants|trouser/i.test(name)) categories["Streetwear"] = (categories["Streetwear"] || 0) + 1;
      else if (/blazer|suit|tailor|coat/i.test(name)) categories["Old Money"] = (categories["Old Money"] || 0) + 1;
      else categories["Other"] = (categories["Other"] || 0) + 1;
    });
    const outfitCategories = Object.keys(categories).map((k) => ({ name: k, value: categories[k] }));

    const activity: string[] = [];
    sessionItems.forEach((it) => {
      activity.push(`Scanned ${it.name || it.sku}`);
      if (it.saved) activity.push(`Saved ${it.name || it.sku}`);
    });
    sessionRequests.forEach((r) => {
      const label = r.requestedSize || r.requestedColor ? `Requested ${r.requestedSize || ""} ${r.requestedColor || ""} (${r.sku})` : `Requested (${r.sku})`;
      activity.push(label);
    });

    return {
      itemsTried: sessionItems.length,
      requestsMade: sessionRequests.length,
      colours: colours.length ? colours : analytics?.colours ?? ["#605A9A", "#A47F7F", "#2E7D32"],
      mostSelectedSize: mostSelectedSize || analytics?.mostSelectedSize || "—",
      outfitCategories: outfitCategories.length ? outfitCategories : analytics?.outfitCategories,
      activity,
    } as Partial<Analytics>;
  }

  useEffect(() => {
    // Force use of backend analytics instead of session-based
    setSessionId(null);

    let interval: any = null;

    async function boot() {
      setLoading(true);
      await fetchGenericAnalytics();
      interval = setInterval(fetchGenericAnalytics, 5000);
      setLoading(false);
    }

    boot();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (sessionId) {
      const derived = deriveAnalyticsFromSession(sessionItems, sessionRequests);
      setAnalytics((prev) => ({ ...(prev || {}), ...derived }));
    }
  }, [sessionItems.length, sessionRequests.length]);

  return (
    <div className="min-h-screen bg-[#F7E9D3]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="rounded-3xl bg-[#FDF6E6] border border-[#E3C89C] shadow-[0_15px_50px_rgba(90,64,34,0.06)] px-8 py-8 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-serif text-[#4F2F14]">Your Session Summary</h1>
              <p className="text-[#8C6A4B] mt-2">A snapshot of the current room activity and guest preferences</p>
            </div>
            <div className="text-sm text-[#7A4F2B]">
              <div className="mb-2 inline-block bg-[#EADCC6] px-3 py-1 rounded-full">Room 7</div>
              <div>Session Timer: 15:00</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl border-l-4 bg-[#FDE7E2] border-l-[#E26C4C] text-[#7A2F1B]">
            {error}
          </div>
        )}

        {/* Top summary row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="col-span-2 rounded-2xl bg-[#FFF4EA] p-6 border border-[#E5D3B8] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[#4F2F14] font-semibold">{analytics?.itemsTried ?? 0} items tried on</div>
              <div className="text-[#4F2F14] font-semibold">{analytics?.requestsMade ?? 0} requests made</div>
            </div>
            <div className="flex gap-4">
              {sessionItems.slice(0, 5).map((item, i) => {
                const itemData = ITEMS_BY_SKU[item.sku];
                return (
                  <div key={i} className="w-20 h-20 bg-[#F7E8DA] rounded-md overflow-hidden">
                    {itemData?.imageUrl ? (
                      <img 
                        src={itemData.imageUrl} 
                        alt={itemData.name || item.sku}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-[#8C6A4B]">
                        {item.sku}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Fill remaining slots with placeholders if needed */}
              {Array.from({ length: Math.max(0, 5 - sessionItems.length) }).map((_, i) => (
                <div key={`placeholder-${i}`} className="w-20 h-20 bg-[#F7E8DA] rounded-md" />
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-[#FFF4EA] p-6 border border-[#E5D3B8] shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[#8C6A4B] text-sm">Saved for Later</div>
                <div className="w-24 h-24 bg-[#F7E8DA] rounded-md mt-3 relative">
                  <div className="absolute -top-2 -right-2 bg-white p-1 rounded-full shadow">❤</div>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-[#F2E6DA] px-3 py-2 rounded-md">Price Ranges<br/><span className="font-semibold">{analytics?.priceRange ?? "—"}</span></div>
                <div className="bg-[#F2E6DA] px-3 py-2 rounded-md mt-4">Favourite Material<br/><span className="font-semibold">{analytics?.favouriteMaterial ?? "—"}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle insights row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="rounded-2xl bg-[#FFF8EC] p-6 border border-[#EBD7B9] shadow-sm">
            <h3 className="text-[#4F2F14] font-semibold mb-4">Perfect Fit Insights</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-[#F3E6D6] px-4 py-2 rounded-md text-[#4F2F14] font-semibold">{analytics?.mostSelectedSize ?? "—"}</div>
              <div className="text-[#7A4F2B]">Most Selected</div>
            </div>

            <hr className="border-t border-[#E9DCC9] my-4" />

            <h4 className="text-[#4F2F14] font-medium mb-3">Outfit Style Categories</h4>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                {analytics?.outfitCategories?.map((c) => (
                  <div key={c.name} className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#F7E8DA] rounded-md" />
                    <div className="text-[#4F2F14] font-medium">{c.name}</div>
                  </div>
                ))}
              </div>
              <div>
                <DonutChart
                  size={110}
                  labels={analytics?.outfitCategories?.map((c) => c.name) ?? []}
                  data={analytics?.outfitCategories?.map((c) => c.value) ?? []}
                  colors={analytics?.colours ?? []}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#FFF8EC] p-6 border border-[#EBD7B9] shadow-sm">
            <h3 className="text-[#4F2F14] font-semibold mb-4">Colour Exploration</h3>
            <div className="flex items-center gap-4">
              {analytics?.colours?.map((c, i) => (
                <ColourDot key={i} color={c} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-[#FFF8EC] p-6 border border-[#EBD7B9] shadow-sm">
            <h3 className="text-[#4F2F14] font-semibold mb-4">Room Activity</h3>
            <div className="space-y-4">
              {analytics?.activity?.map((a, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-3">
                    <div className="w-3 h-3 rounded-full bg-[#5B3D1C] mt-1" />
                    {i < (analytics.activity?.length ?? 0) - 1 && <div className="w-px bg-[#E1D2C2] h-10 ml-1" />}
                  </div>
                  <div className="text-[#6F4F33]">{a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={async () => {
              setLoading(true);
              try {
                if (sessionId) {
                  await fetchSession(sessionId);
                  await fetchRequestsForSession(sessionId);
                } else {
                  await fetchGenericAnalytics();
                }
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="px-6 py-3 bg-[#8A623C] text-[#FFF7EB] rounded-full font-semibold shadow-lg hover:bg-[#714E2F] disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
    </div>
  );
}
