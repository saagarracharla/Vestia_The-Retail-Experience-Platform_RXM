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
                    {["ID", "Session ID", "SKU", "Requested Size", "Requested Colour", "Status", "Actions"].map(
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
                        <div className="flex gap-2 items-center flex-nowrap">
                          {r.status !== "Delivered" && (
                            <button
                              onClick={() => updateRequestStatus(r.id, "Delivered")}
                              className="px-4 py-2 rounded-full text-sm font-semibold bg-[#C7A070] text-[#3F250F] hover:bg-[#B88D57] transition whitespace-nowrap"
                            >
                              Mark Delivered
                            </button>
                          )}
                          {r.status === "Queued" && (
                            <button
                              onClick={() => updateRequestStatus(r.id, "PickedUp")}
                              className="px-4 py-2 rounded-full text-sm font-semibold bg-[#E2C291] text-[#3F250F] hover:bg-[#D5AF75] transition whitespace-nowrap"
                            >
                              Pick Up
                            </button>
                          )}
                          {r.status !== "Cancelled" && r.status !== "Delivered" && (
                            <button
                              onClick={() => updateRequestStatus(r.id, "Cancelled")}
                              className="px-4 py-2 rounded-full text-sm font-semibold bg-[#B86B4D] text-[#FFF7EB] hover:bg-[#A5553B] transition whitespace-nowrap"
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
