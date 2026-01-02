"use client";

import { useState, useEffect } from "react";
import { VestiaAPI } from "@/lib/api";

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
};

export default function AdminPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  async function loadRequests() {
    setLoading(true);
    try {
      // Call the real AWS store requests endpoint
      const response = await fetch("https://993toyh3x5.execute-api.ca-central-1.amazonaws.com/store/STORE-001/request", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Transform AWS response to match admin page format
      const transformedRequests = data.requests.map((req: any, index: number) => ({
        id: index + 1,
        sessionId: req.sessionId,
        sku: req.sku,
        kioskId: req.kioskId,
        requestedSize: req.requestedSize,
        requestedColor: req.requestedColor,
        status: req.status,
        requestId: req.requestId,
        name: req.name,
        price: req.price
      }));

      setRequests(transformedRequests);
      setMessage(data.requests.length > 0 ? `Loaded ${data.requests.length} requests` : "No pending requests");
      setMessageType("success");
    } catch (err) {
      console.error(err);
      setMessage("Failed to load requests.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function updateRequestStatus(id: number, status: string, action?: string) {
    setMessage("");
    try {
      const request = requests.find(r => r.id === id);
      if (!request || !request.requestId) {
        throw new Error("Request not found");
      }

      const body: any = {};
      if (status) body.status = status;
      if (action) body.action = action;

      const response = await fetch(`https://993toyh3x5.execute-api.ca-central-1.amazonaws.com/request/${request.requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update request");
      }

      const result = await response.json();
      setMessage(`Request ${request.requestId} updated to ${result.status}${result.autoScan ? ' (item delivered to kiosk)' : ''}`);
      setMessageType("success");
      
      await loadRequests();
    } catch (err) {
      console.error(err);
      setMessage(`Failed to update request: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setMessageType("error");
    }
  }

  const handleCancel = (id: number) => updateRequestStatus(id, "CANCELLED");
  const handlePickup = (id: number) => updateRequestStatus(id, "CLAIMED");
  const handleDeliver = (id: number) => updateRequestStatus(id, "", "delivered");

  useEffect(() => {
    loadRequests();
    // Refresh every 5 seconds (reduced from 3)
    const interval = setInterval(loadRequests, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "Queued":
        return "bg-[#EFE1CA] text-[#7A4F2B]";
      case "PickedUp":
        return "bg-[#E1D2C2] text-[#5B3D1C]";
      case "Delivered":
        return "bg-[#D8E3CF] text-[#2B5734]";
      case "Cancelled":
        return "bg-[#F4D5CB] text-[#8C3B2D]";
      default:
        return "bg-[#EEE3D2] text-[#5B3D1C]";
    }
  };

  const formatStatus = (status: string) => {
    if (status === "PickedUp") return "Picked Up";
    return status;
  };

  return (
    <div className="min-h-screen bg-[#F7E9D3]">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="rounded-3xl bg-[#FDF6E6] border border-[#E3C89C] shadow-[0_15px_50px_rgba(90,64,34,0.1)] px-8 py-10 mb-8">
          <p className="text-sm uppercase tracking-[0.4em] text-[#B08858]">
            Vestia Staff
          </p>
          <h1 className="text-5xl font-serif text-[#4F2F14] mt-4 mb-4">
            Staff Dashboard
          </h1>
          <p className="text-[#8C6A4B] text-lg max-w-2xl">
            Review active fitting room requests and keep guests updated as their
            items move through the queue.
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-2xl border-l-4 ${
              messageType === "success"
                ? "bg-[#E1F2DB] border-l-emerald-400 text-[#205530]"
                : "bg-[#FDE7E2] border-l-[#E26C4C] text-[#7A2F1B]"
            }`}
          >
            {message}
          </div>
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h2 className="text-3xl font-serif text-[#4F2F14]">
              Active Requests{" "}
              <span className="text-[#B08455]">({requests.length})</span>
            </h2>
            <p className="text-[#9A7551]">
              Updated automatically every few seconds
            </p>
          </div>
          <button
            onClick={loadRequests}
            disabled={loading}
            className="px-8 py-3 bg-[#8A623C] text-[#FFF7EB] rounded-full font-semibold shadow-lg shadow-[#C09A72]/50 hover:bg-[#714E2F] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading && requests.length === 0 ? (
          <div className="bg-[#FFF8EC] rounded-3xl p-12 border border-[#EBD7B9] text-center shadow-inner">
            <p className="text-[#B08455] text-lg">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-[#FFF8EC] rounded-3xl p-12 border border-[#EBD7B9] text-center shadow-inner">
            <p className="text-[#9A7551] text-lg max-w-2xl mx-auto">
              No active requests. They'll appear here in real time as customers
              request items from the kiosk.
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-[#E4CCAA] bg-[#FFF8EC] shadow-lg shadow-[#BA8E5F]/10 overflow-hidden">
            <div className="w-full">
              <table className="w-full">
                <thead className="bg-[#F1DDC0] text-[#5B3D1C] text-left uppercase text-xs tracking-[0.2em]">
                  <tr>
                    {["ID", "Session ID", "SKU", "Kiosk", "Size", "Color", "Status", "Actions"].map(
                      (heading) => (
                        <th key={heading} className="px-8 py-4 font-semibold">
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r, index) => (
                    <tr
                      key={r.id}
                      className={`${
                        index % 2 === 0 ? "bg-[#FFF4E0]" : "bg-[#FFF8EC]"
                      } border-t border-[#F2E0C6]`}
                    >
                      <td className="px-8 py-5 text-[#4F2F14] font-semibold">
                        #{r.id}
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-xs tracking-wide font-mono bg-[#F8EAD1] text-[#8A623C] px-3 py-1 rounded-full">
                          {r.sessionId}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-[#4F2F14] font-semibold">
                        {r.sku}
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-xs tracking-wide font-mono bg-[#E8F4FD] text-[#1E40AF] px-3 py-1 rounded-full">
                          {r.kioskId || "Unknown"}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-[#7A4F2B]">
                        {r.requestedSize || "—"}
                      </td>
                      <td className="px-8 py-5 text-[#7A4F2B]">
                        {r.requestedColor || "—"}
                      </td>
                      <td className="px-8 py-5">
                        <span
                          className={`inline-flex px-4 py-1.5 rounded-full text-sm font-semibold ${getStatusStyles(
                            r.status
                          )}`}
                        >
                          {formatStatus(r.status)}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex gap-2 items-center flex-wrap">
                          {r.status === "QUEUED" && (
                            <>
                              <button
                                onClick={() => handleCancel(r.id)}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 transition"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handlePickup(r.id)}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                              >
                                Picked Up
                              </button>
                            </>
                          )}
                          {r.status === "CLAIMED" && (
                            <button
                              onClick={() => handleDeliver(r.id)}
                              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 transition"
                            >
                              Delivered
                            </button>
                          )}
                          {(r.status === "DELIVERED" || r.status === "CANCELLED") && (
                            <span className="text-xs text-gray-500">No actions</span>
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
