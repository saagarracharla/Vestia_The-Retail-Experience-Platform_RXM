"use client";

import { useState } from "react";

type Item = {
  sku: string;
  name: string;
  color: string;
  size: string;
};

export default function KioskPage() {
  const [sessionId, setSessionId] = useState("session-1");
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [feedbackRating, setFeedbackRating] = useState("5");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [message, setMessage] = useState("");

  const BACKEND_URL = "http://localhost:4000";

  async function handleScan() {
    setMessage("");
    if (!sessionId || !sku) {
      setMessage("Session ID and SKU are required.");
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/session/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, sku, name, color, size }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setMessage(errorData.error || "Failed to scan item.");
        return;
      }

      const data = await res.json();
      setItems(data.items || []);
      setMessage("Item scanned successfully.");
      setSku("");
      setName("");
      setColor("");
      setSize("");
    } catch (err) {
      console.error(err);
      setMessage("Network error while scanning item.");
    }
  }

  async function handleRequestDifferentSize(itemSku: string) {
    setMessage("");
    try {
      // For PoC we hard-code requested size to "L"
      const res = await fetch(`${BACKEND_URL}/api/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          sku: itemSku,
          requestedSize: "L",
          requestedColor: color || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setMessage(errorData.error || "Failed to send request.");
        return;
      }

      await res.json();
      setMessage("Request for different size sent to staff.");
    } catch (err) {
      console.error(err);
      setMessage("Network error while sending request.");
    }
  }

  async function handleSubmitFeedback() {
    setMessage("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          rating: Number(feedbackRating),
          comment: feedbackComment,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setMessage(errorData.error || "Failed to submit feedback.");
        return;
      }

      await res.json();
      setMessage("Thanks for your feedback!");
      setFeedbackComment("");
      setFeedbackRating("5");
    } catch (err) {
      console.error(err);
      setMessage("Network error while submitting feedback.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-slate-800 rounded-2xl shadow-lg p-6 space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold">Vestia Kiosk</h1>
            <p className="text-sm text-slate-300">
              Changeroom Session • Scan items, request sizes, leave feedback
            </p>
          </div>
          <div>
            <label className="text-xs text-slate-300 block mb-1">
              Session ID
            </label>
            <input
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-md px-2 py-1 text-sm"
            />
          </div>
        </header>

        {message && (
          <div className="text-sm text-emerald-300 bg-emerald-900/30 border border-emerald-500/40 rounded-md px-3 py-2">
            {message}
          </div>
        )}

        {/* Scan item section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Scan Item</h2>
            <div className="space-y-2 text-sm">
              <div>
                <label className="block text-slate-300 mb-1">SKU</label>
                <input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-md px-2 py-1"
                  placeholder="e.g. SKU123"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-md px-2 py-1"
                  placeholder="e.g. Blue Slim-Fit Shirt"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Color</label>
                  <input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-md px-2 py-1"
                    placeholder="e.g. blue"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Size</label>
                  <input
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-md px-2 py-1"
                    placeholder="e.g. M"
                  />
                </div>
              </div>
              <button
                onClick={handleScan}
                className="mt-2 w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold rounded-md py-2 text-sm"
              >
                Scan Item into Session
              </button>
            </div>
          </div>

          {/* Live tray */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Live Tray</h2>
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">
                No items scanned yet. Scan something to see it here.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.sku + item.size}
                    className="border border-slate-600 rounded-md px-3 py-2 text-sm flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-slate-300">
                        SKU: {item.sku} • {item.color} • Size {item.size}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRequestDifferentSize(item.sku)}
                      className="bg-sky-500 hover:bg-sky-400 text-slate-900 font-semibold rounded-md px-3 py-1 text-xs"
                    >
                      Request size L
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Feedback */}
        <section className="border-t border-slate-700 pt-4">
          <h2 className="text-lg font-semibold mb-2">
            End Session & Leave Feedback
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-slate-300 mb-1">
                Overall rating
              </label>
              <select
                value={feedbackRating}
                onChange={(e) => setFeedbackRating(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-md px-2 py-1"
              >
                <option value="5">5 - Loved it</option>
                <option value="4">4 - Good</option>
                <option value="3">3 - Okay</option>
                <option value="2">2 - Not great</option>
                <option value="1">1 - Terrible</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-slate-300 mb-1">
                Comments (optional)
              </label>
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-md px-2 py-1 min-h-[60px]"
                placeholder="Tell us about fit, comfort, staff, etc."
              />
            </div>
          </div>
          <button
            onClick={handleSubmitFeedback}
            className="mt-3 bg-purple-500 hover:bg-purple-400 text-slate-900 font-semibold rounded-md px-4 py-2 text-sm"
          >
            Submit Feedback
          </button>
        </section>
      </div>
    </main>
  );
}
