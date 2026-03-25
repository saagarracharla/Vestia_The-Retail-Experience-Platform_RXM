"use client";

import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import LoadingSpinner from "@/components/LoadingSpinner";

type RequestItem = {
  id: number;
  sessionId: string;
  sku: string;
  kioskId?: string;
  requestedSize: string | null;
  requestedColor: string | null;
  status: string;
  requestId?: string;
  name?: string;
  price?: number;
  createdAt?: string;
};

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string; ring: string }> = {
  QUEUED:    { label: "Queued",    dot: "bg-amber-400",  badge: "status-queued",    ring: "ring-amber-200" },
  CLAIMED:   { label: "Claimed",   dot: "bg-blue-400",   badge: "status-claimed",   ring: "ring-blue-200" },
  DELIVERED: { label: "Delivered", dot: "bg-emerald-400",badge: "status-delivered", ring: "ring-emerald-200" },
  CANCELLED: { label: "Cancelled", dot: "bg-red-300",    badge: "status-cancelled", ring: "ring-red-100" },
};

function timeAgo(ts?: string) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function AdminPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const inProgressRef = useRef<Set<string>>(new Set());

  function showToast(text: string, ok = true) {
    setToastMsg({ text, ok });
    setTimeout(() => setToastMsg(null), 3500);
  }

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await fetch("https://993toyh3x5.execute-api.ca-central-1.amazonaws.com/store/STORE-001/request", {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRequests(
        data.requests.map((req: any, i: number) => ({
          id: i + 1,
          sessionId: req.sessionId,
          sku: req.sku,
          kioskId: req.kioskId,
          requestedSize: req.requestedSize,
          requestedColor: req.requestedColor,
          status: req.status,
          requestId: req.requestId,
          name: req.name,
          price: req.price,
          createdAt: req.createdAt,
        }))
      );
    } catch (err) {
      showToast("Failed to load requests", false);
    } finally {
      setLoading(false);
    }
  }

  async function updateRequest(r: RequestItem, status?: string, action?: string) {
    if (!r.requestId) return;
    const key = `${r.requestId}-${status}-${action}`;
    if (inProgressRef.current.has(key)) return;
    inProgressRef.current.add(key);
    setUpdatingId(r.requestId);
    try {
      const body: any = {};
      if (status) body.status = status;
      if (action) body.action = action;
      const res = await fetch(
        `https://993toyh3x5.execute-api.ca-central-1.amazonaws.com/request/${r.requestId}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      if (!res.ok) throw new Error();
      const result = await res.json();
      showToast(`Request updated → ${result.status}${result.autoScan ? " · item auto-scanned" : ""}`);
      setTimeout(loadRequests, 400);
    } catch {
      showToast("Failed to update request", false);
    } finally {
      setTimeout(() => { inProgressRef.current.delete(key); setUpdatingId(null); }, 2000);
    }
  }

  useEffect(() => {
    loadRequests();
    const t = setInterval(loadRequests, 5000);
    return () => clearInterval(t);
  }, []);

  const active   = requests.filter(r => r.status === "QUEUED" || r.status === "CLAIMED");
  const done     = requests.filter(r => r.status === "DELIVERED" || r.status === "CANCELLED");

  return (
    <div className="min-h-screen bg-[#F7EDE0]">
      <Navbar />

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-20 right-6 z-50 animate-slide-in-elegant px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold border ${
          toastMsg.ok
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : "bg-red-50 text-red-800 border-red-200"
        }`}>
          {toastMsg.ok ? "✓ " : "✕ "}{toastMsg.text}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#C17B3E] mb-2">Staff Dashboard</p>
            <h1 className="text-4xl font-bold text-[#1C1007]">Request Queue</h1>
            <p className="text-[#8C6A4B] mt-1">Live fitting room requests · auto-refreshes every 5s</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              {Object.entries(STATUS_CONFIG).slice(0, 2).map(([s, cfg]) => (
                <div key={s} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${cfg.badge}`}>
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  {requests.filter(r => r.status === s).length} {cfg.label}
                </div>
              ))}
            </div>
            <button
              onClick={loadRequests}
              disabled={loading}
              className="px-5 py-2.5 bg-[#4A3A2E] hover:bg-[#3B2A21] text-[#FDF7EF] rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Active Requests */}
        {loading && active.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-[#E5D5C8] border-t-[#4A3A2E] rounded-full animate-spin" />
          </div>
        ) : active.length === 0 ? (
          <div className="bg-[#FDF7EF] rounded-3xl border-2 border-dashed border-[#E5D5C8] p-16 text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-[#F0E0CC] flex items-center justify-center mx-auto mb-4 text-2xl">🛍️</div>
            <p className="text-[#4A3A2E] font-semibold text-lg">All clear</p>
            <p className="text-[#8C6A4B] text-sm mt-1">New requests will appear here in real time</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
            {active.map((r) => {
              const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.QUEUED;
              const busy = updatingId === r.requestId;
              return (
                <div
                  key={r.requestId}
                  className={`bg-[#FDF7EF] rounded-2xl border-2 border-[#E5D5C8] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${r.status === "QUEUED" ? "ring-2 ring-amber-100" : "ring-2 ring-blue-100"}`}
                >
                  {/* Top accent stripe */}
                  <div className={`h-1 w-full ${cfg.dot}`} />

                  <div className="p-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[#8C6A4B]">Room {r.kioskId || "—"}</p>
                        <p className="text-lg font-bold text-[#1C1007] mt-0.5">SKU {r.sku}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${cfg.badge} flex items-center gap-1.5`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Request details */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {r.requestedSize && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5E9DA] rounded-xl border border-[#E5D5C8]">
                          <span className="text-xs text-[#8C6A4B] font-medium">Size</span>
                          <span className="text-sm font-bold text-[#1C1007]">{r.requestedSize}</span>
                        </div>
                      )}
                      {r.requestedColor && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5E9DA] rounded-xl border border-[#E5D5C8]">
                          <span className="text-xs text-[#8C6A4B] font-medium">Color</span>
                          <span className="text-sm font-bold text-[#1C1007] capitalize">{r.requestedColor}</span>
                        </div>
                      )}
                      {!r.requestedSize && !r.requestedColor && (
                        <span className="px-3 py-1.5 bg-[#F5E9DA] text-[#8C6A4B] text-xs rounded-xl border border-[#E5D5C8]">General request</span>
                      )}
                    </div>

                    {/* Session + time */}
                    <div className="flex items-center justify-between text-xs text-[#8C6A4B] mb-4">
                      <span className="font-mono bg-[#F0E0CC] px-2 py-1 rounded-lg truncate max-w-[60%]">{r.sessionId}</span>
                      <span>{timeAgo(r.createdAt)}</span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      {r.status === "QUEUED" && (
                        <>
                          <button
                            onClick={() => updateRequest(r, "CANCELLED")}
                            disabled={busy}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {busy ? <span className="flex justify-center"><LoadingSpinner size="sm" /></span> : "Cancel"}
                          </button>
                          <button
                            onClick={() => updateRequest(r, "CLAIMED")}
                            disabled={busy}
                            className="flex-[2] py-2.5 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {busy ? <span className="flex justify-center"><LoadingSpinner size="sm" /></span> : "Pick Up →"}
                          </button>
                        </>
                      )}
                      {r.status === "CLAIMED" && (
                        <button
                          onClick={() => updateRequest(r, undefined, "delivered")}
                          disabled={busy}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 transition-all active:scale-95 disabled:opacity-50 animate-pulse-glow"
                        >
                          {busy ? <span className="flex justify-center"><LoadingSpinner size="sm" /></span> : "✓ Mark Delivered"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Completed / Cancelled */}
        {done.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center gap-3 text-sm font-semibold text-[#8C6A4B] hover:text-[#4A3A2E] transition-colors mb-4 select-none">
              <span className="w-5 h-5 rounded-full bg-[#E5D5C8] flex items-center justify-center text-xs group-open:rotate-90 transition-transform">▸</span>
              Completed &amp; Cancelled ({done.length})
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {done.map((r) => {
                const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.CANCELLED;
                return (
                  <div key={r.requestId} className="bg-[#FDF7EF]/60 rounded-2xl border border-[#E5D5C8] p-4 opacity-70">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-[#4A3A2E] text-sm">SKU {r.sku}</p>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <div className="flex gap-2 text-xs text-[#8C6A4B]">
                      {r.requestedSize && <span>Size {r.requestedSize}</span>}
                      {r.requestedColor && <span className="capitalize">{r.requestedColor}</span>}
                      <span className="ml-auto">{timeAgo(r.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
