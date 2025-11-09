"use client";

import { useEffect, useState } from "react";

type RequestItem = {
  id: number;
  sessionId: string;
  sku: string;
  requestedSize: string | null;
  requestedColor: string | null;
  status: string;
};

type Analytics = {
  totalSessions: number;
  totalRequests: number;
  avgRating: number;
};

const BACKEND_URL = "http://localhost:4000";

export default function AdminPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [message, setMessage] = useState("");

  async function loadRequests() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/requests`);
      const data = await res.json();
      setRequests(data || []);
    } catch (err) {
      console.error(err);
      setMessage("Failed to load requests.");
    }
  }

  async function loadAnalytics() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/analytics`);
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error(err);
      setMessage("Failed to load analytics.");
    }
  }

  async function updateRequestStatus(id: number, status: string) {
    setMessage("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/request/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setMessage(errorData.error || "Failed to update request.");
        return;
      }

      await res.json();
      setMessage(`Request ${id} marked as ${status}.`);
      await loadRequests();
      await loadAnalytics();
    } catch (err) {
      console.error(err);
      setMessage("Network error while updating request.");
    }
  }

  // Load data when page mounts
  useEffect(() => {
    loadRequests();
    loadAnalytics();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-5xl bg-slate-900 rounded-2xl shadow-lg p-6 space-y-6">
        <header className="flex flex-col md:flex-row justify-between gap-3 items-start md:items-center">
          <div>
            <h1 className="text-2xl font-semibold">Vestia Staff Dashboard</h1>
            <p className="text-sm text-slate-300">
              View fitting room requests & live analytics
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadRequests}
              className="bg-sky-500 hover:bg-sky-400 text-slate-900 text-sm font-semibold rounded-md px-3 py-1.5"
            >
              Refresh Requests
            </button>
            <button
              onClick={loadAnalytics}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-sm font-semibold rounded-md px-3 py-1.5"
            >
              Refresh Analytics
            </button>
          </div>
        </header>

        {message && (
          <div className="text-sm text-emerald-300 bg-emerald-900/30 border border-emerald-500/40 rounded-md px-3 py-2">
            {message}
          </div>
        )}

        {/* Analytics summary */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-slate-800 rounded-xl p-4">
            <div className="text-slate-400">Total Sessions</div>
            <div className="text-2xl font-semibold">
              {analytics ? analytics.totalSessions : "-"}
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4">
            <div className="text-slate-400">Total Requests</div>
            <div className="text-2xl font-semibold">
              {analytics ? analytics.totalRequests : "-"}
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4">
            <div className="text-slate-400">Avg. Rating</div>
            <div className="text-2xl font-semibold">
              {analytics ? analytics.avgRating.toFixed(1) : "-"}
            </div>
          </div>
        </section>

        {/* Requests table */}
        <section>
          <h2 className="text-lg font-semibold mb-2">
            Live Size/Colour Requests
          </h2>
          {requests.length === 0 ? (
            <p className="text-sm text-slate-400">
              No active requests. They’ll appear here in real time as customers
              request items from the kiosk.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-700 rounded-lg overflow-hidden">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">Session</th>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Size</th>
                    <th className="px-3 py-2 text-left">Colour</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-t border-slate-700">
                      <td className="px-3 py-2">{r.id}</td>
                      <td className="px-3 py-2">{r.sessionId}</td>
                      <td className="px-3 py-2">{r.sku}</td>
                      <td className="px-3 py-2">
                        {r.requestedSize || "-"}
                      </td>
                      <td className="px-3 py-2">
                        {r.requestedColor || "-"}
                      </td>
                      <td className="px-3 py-2">{r.status}</td>
                      <td className="px-3 py-2 space-x-2">
                        <button
                          onClick={() => updateRequestStatus(r.id, "PickedUp")}
                          className="bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-md px-2 py-1 text-xs"
                        >
                          Picked Up
                        </button>
                        <button
                          onClick={() => updateRequestStatus(r.id, "Delivered")}
                          className="bg-emerald-400 hover:bg-emerald-300 text-slate-900 rounded-md px-2 py-1 text-xs"
                        >
                          Delivered
                        </button>
                        <button
                          onClick={() => updateRequestStatus(r.id, "Cancelled")}
                          className="bg-rose-400 hover:bg-rose-300 text-slate-900 rounded-md px-2 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
