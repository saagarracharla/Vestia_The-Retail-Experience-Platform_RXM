"use client";

import { useState, useEffect } from "react";

type RequestItem = {
  id: number;
  sessionId: string;
  sku: string;
  requestedSize: string | null;
  requestedColor: string | null;
  status: string;
};

const BACKEND_URL = "http://localhost:4000";

export default function AdminPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/requests`);
      if (!res.ok) {
        throw new Error("Failed to load requests");
      }
      const data = await res.json();
      setRequests(data || []);
    } catch (err) {
      console.error(err);
      setMessage("Failed to load requests.");
      setMessageType("error");
    } finally {
      setLoading(false);
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
        setMessageType("error");
        return;
      }

      await res.json();
      setMessage(`Request ${id} marked as ${status}.`);
      setMessageType("success");
      await loadRequests();
    } catch (err) {
      console.error(err);
      setMessage("Network error while updating request.");
      setMessageType("error");
    }
  }

  useEffect(() => {
    loadRequests();
    // Refresh every 3 seconds
    const interval = setInterval(loadRequests, 3000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Queued":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "PickedUp":
        return "bg-amber-100 text-amber-700 border-amber-300";
      case "Delivered":
        return "bg-emerald-100 text-emerald-700 border-emerald-300";
      case "Cancelled":
        return "bg-red-100 text-red-700 border-red-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            Staff Dashboard
          </h1>
          <p className="text-gray-600">
            Manage fitting room requests and track deliveries
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border ${
              messageType === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Active Requests ({requests.length})
          </h2>
          <button
            onClick={loadRequests}
            disabled={loading}
            className="px-4 py-2 bg-[#0066CC] hover:bg-[#0052A3] text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading && requests.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-gray-200 text-center shadow-sm">
            <p className="text-gray-500">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-gray-200 text-center shadow-sm">
            <p className="text-gray-500">
              No active requests. They'll appear here in real time as customers
              request items from the kiosk.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Session ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      SKU
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Requested Size
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Requested Color
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {requests.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 text-gray-900 font-medium">
                        #{r.id}
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs bg-gray-100 text-[#0066CC] px-2 py-1 rounded font-mono">
                          {r.sessionId}
                        </code>
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-medium">
                        {r.sku}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {r.requestedSize || "-"}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {r.requestedColor || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            r.status
                          )}`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {r.status !== "Delivered" && (
                            <button
                              onClick={() => updateRequestStatus(r.id, "Delivered")}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-all duration-200 text-sm shadow-sm"
                            >
                              Mark Delivered
                            </button>
                          )}
                          {r.status === "Queued" && (
                            <button
                              onClick={() => updateRequestStatus(r.id, "PickedUp")}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-all duration-200 text-sm shadow-sm"
                            >
                              Picked Up
                            </button>
                          )}
                          {r.status !== "Cancelled" && r.status !== "Delivered" && (
                            <button
                              onClick={() => updateRequestStatus(r.id, "Cancelled")}
                              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-all duration-200 text-sm shadow-sm"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
