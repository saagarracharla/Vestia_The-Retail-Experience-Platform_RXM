"use client";

import { useState, useEffect } from "react";
import ItemCard from "@/components/ItemCard";
import Modal from "@/components/Modal";
import SessionTimer from "@/components/SessionTimer";
import WelcomeScreen from "@/components/WelcomeScreen";
import {
  RecommendedOutfitsPlaceholder,
  MixAndMatchPlaceholder,
} from "@/components/FutureFeaturesPlaceholder";
import { generateSessionId } from "@/utils/sessionId";
import { VestiaAPI, ItemWithProduct } from "@/lib/api";

type Item = ItemWithProduct;

export default function KioskPage() {
  const [hasStartedSession, setHasStartedSession] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sku, setSku] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  // Loading states
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Modal states
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [requestedSize, setRequestedSize] = useState("");
  const [requestedColor, setRequestedColor] = useState("");
  const [feedbackRating, setFeedbackRating] = useState("5");
  const [feedbackComment, setFeedbackComment] = useState("");

  function initializeSession() {
    if (!sessionId) {
      const newSessionId = generateSessionId();
      const startTime = new Date();
      setSessionId(newSessionId);
      setSessionStartTime(startTime);
      localStorage.setItem("sessionId", newSessionId);
      localStorage.setItem("sessionStartTime", startTime.toISOString());
    }
  }

  async function handleScan() {
    setMessage("");
    if (!sku) {
      setMessage("SKU is required.");
      setMessageType("error");
      return;
    }

    if (isScanning) return; // Prevent double-clicks
    setIsScanning(true);

    // Initialize session on first scan
    if (!sessionId) {
      initializeSession();
    }

    const currentSessionId = sessionId || generateSessionId();
    if (!sessionId) {
      const startTime = new Date();
      setSessionId(currentSessionId);
      setSessionStartTime(startTime);
      localStorage.setItem("sessionId", currentSessionId);
      localStorage.setItem("sessionStartTime", startTime.toISOString());
    }

    try {
      // Scan item with only SKU
      console.log("Scanning SKU:", sku, "for session:", currentSessionId);
      await VestiaAPI.scanItem(currentSessionId, sku, "KIOSK-001");

      // Fetch updated session data with product metadata
      console.log("Fetching session data...");
      const itemsWithProducts = await VestiaAPI.getSessionWithProducts(currentSessionId);
      console.log("Session data received:", itemsWithProducts);
      setItems(itemsWithProducts || []);
      
      setMessage(`Item scanned successfully!`);
      setMessageType("success");
      setSku("");
    } catch (err) {
      console.error("Scan error:", err);
      setMessage(`Failed to scan item: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setMessageType("error");
    } finally {
      setIsScanning(false);
    }
  }

  function handleRequestSize(item: Item) {
    setSelectedItem(item);
    setRequestedSize("");
    setRequestedColor("");
    setIsRequestModalOpen(true);
  }

  async function submitRequest() {
    if (!selectedItem || !sessionId) return;

    if (isSubmittingRequest) return; // Prevent double-clicks
    setIsSubmittingRequest(true);

    setMessage("");
    try {
      await VestiaAPI.createRequest({
        sessionId,
        sku: selectedItem.sku,
        requestedSize: requestedSize || undefined,
        requestedColor: requestedColor || undefined,
      });

      // Refresh session to show any updates
      const itemsWithProducts = await VestiaAPI.getSessionWithProducts(sessionId);
      setItems(itemsWithProducts || []);

      setMessage("Request sent successfully!");
      setMessageType("success");
      setIsRequestModalOpen(false);
      setSelectedItem(null);
      setRequestedSize("");
      setRequestedColor("");
    } catch (err) {
      console.error(err);
      setMessage("Network error while sending request.");
      setMessageType("error");
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  function handleLeaveFeedback(item: Item) {
    setSelectedItem(item);
    setFeedbackRating("5");
    setFeedbackComment("");
    setIsFeedbackModalOpen(true);
  }

  async function submitFeedback() {
    if (!sessionId) return;

    setMessage("");
    try {
      // TODO: Implement feedback endpoint in AWS
      console.log("Feedback submitted:", {
        sessionId,
        rating: Number(feedbackRating),
        comment: feedbackComment,
      });

      setMessage("Thank you for your feedback!");
      setMessageType("success");
      setIsFeedbackModalOpen(false);
      setSelectedItem(null);
      setFeedbackComment("");
      setFeedbackRating("5");
    } catch (err) {
      console.error(err);
      setMessage("Network error while submitting feedback.");
      setMessageType("error");
    }
  }

  // Show welcome screen if session hasn't started
  if (!hasStartedSession) {
    return <WelcomeScreen />;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* Hero Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Smart Fitting Room Experience
              </h1>
              <p className="text-gray-600 text-lg">
                Scan items and get personalized recommendations
              </p>
            </div>
            {sessionStartTime && (
              <div className="flex items-center">
                <SessionTimer startTime={sessionStartTime} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Scan Item Section */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Scan Item
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SKU *
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. SKU123"
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="mt-4 w-full md:w-auto px-8 py-3 bg-[#0066CC] hover:bg-[#0052A3] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
              >
                {isScanning ? "Scanning..." : "Scan Item"}
              </button>
            </div>

            {/* Scanned Items */}
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Your Items ({items.length})
              </h2>
              {items.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center shadow-sm">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
                    <svg
                      className="w-10 h-10 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium">
                    No items scanned yet. Scan an item to get started.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {items.map((item, index) => (
                    <ItemCard
                      key={`${item.sku}-${index}`}
                      item={item}
                      onRequestSize={handleRequestSize}
                      onLeaveFeedback={handleLeaveFeedback}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Future Features */}
          <div className="space-y-6">
            <RecommendedOutfitsPlaceholder />
            <MixAndMatchPlaceholder />
          </div>
        </div>
      </div>

      {/* Request Size Modal */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => {
          setIsRequestModalOpen(false);
          setSelectedItem(null);
        }}
        title="Request Different Size or Color"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Current Item</p>
              <p className="font-medium text-gray-900">{selectedItem.product?.name || 'Unknown Product'}</p>
              <p className="text-sm text-gray-600">
                {selectedItem.derivedColor || selectedItem.product?.color || 'Unknown'} • {selectedItem.derivedSize ? `Size ${selectedItem.derivedSize}` : 'Size N/A'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Requested Size
              </label>
              <input
                type="text"
                value={requestedSize}
                onChange={(e) => setRequestedSize(e.target.value)}
                placeholder="e.g. L"
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Requested Color
              </label>
              <input
                type="text"
                value={requestedColor}
                onChange={(e) => setRequestedColor(e.target.value)}
                placeholder="e.g. Red"
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent transition-all"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setIsRequestModalOpen(false);
                  setSelectedItem(null);
                }}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={submitRequest}
                disabled={isSubmittingRequest}
                className="flex-1 px-4 py-2.5 bg-[#0066CC] hover:bg-[#0052A3] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200"
              >
                {isSubmittingRequest ? "Sending..." : "Send Request"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Feedback Modal */}
      <Modal
        isOpen={isFeedbackModalOpen}
        onClose={() => {
          setIsFeedbackModalOpen(false);
          setSelectedItem(null);
        }}
        title="Leave Feedback"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rating
            </label>
            <select
              value={feedbackRating}
              onChange={(e) => setFeedbackRating(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent transition-all"
            >
              <option value="5">5 - Loved it</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Okay</option>
              <option value="2">2 - Not great</option>
              <option value="1">1 - Terrible</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comments (optional)
            </label>
            <textarea
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="Tell us about fit, comfort, staff, etc."
              rows={4}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent transition-all resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setIsFeedbackModalOpen(false);
                setSelectedItem(null);
              }}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={submitFeedback}
              className="flex-1 px-4 py-2.5 bg-[#0066CC] hover:bg-[#0052A3] text-white font-semibold rounded-lg transition-all duration-200"
            >
              Submit Feedback
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
