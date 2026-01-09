"use client";

import { useState, useEffect } from "react";

interface SessionTimerProps {
  startTime: Date | null;
  onTimeExpired?: () => void;
  maxDuration?: number; // in seconds, default 15 minutes
}

export default function SessionTimer({ 
  startTime, 
  onTimeExpired,
  maxDuration = 15 * 60 
}: SessionTimerProps) {
  const [timeLeft, setTimeLeft] = useState(maxDuration);
  const [showPopup, setShowPopup] = useState(false);
  const [hasNotifiedLowTime, setHasNotifiedLowTime] = useState(false);

  useEffect(() => {
    if (!startTime) {
      setTimeLeft(maxDuration);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      const remaining = Math.max(0, maxDuration - elapsed);
      
      setTimeLeft(remaining);
      
      // Notify when 5 minutes remaining (only once)
      if (remaining <= 300 && remaining > 0 && !hasNotifiedLowTime) {
        setHasNotifiedLowTime(true);
        // Optional: trigger a subtle notification
      }
      
      // Show popup when time is up
      if (remaining === 0 && !showPopup) {
        setShowPopup(true);
        if (onTimeExpired) {
          onTimeExpired();
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startTime, showPopup, maxDuration, onTimeExpired, hasNotifiedLowTime]);

  if (!startTime) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLowTime = timeLeft <= 300 && timeLeft > 0; // Last 5 minutes
  const isExpired = timeLeft === 0;

  // Accessibility: Screen reader announcement
  const timeAnnouncement = isExpired 
    ? "Session time expired" 
    : isLowTime 
    ? `Warning: ${minutes} minutes remaining` 
    : `${minutes} minutes and ${seconds} seconds remaining`;

  return (
    <>
      <div 
        className="flex items-center gap-2 text-sm"
        role="timer"
        aria-live="polite"
        aria-atomic="true"
        aria-label={timeAnnouncement}
      >
        <div 
          className={`w-2 h-2 rounded-full animate-pulse ${
            isExpired ? 'bg-red-500' : isLowTime ? 'bg-yellow-500' : 'bg-emerald-500'
          }`}
          aria-hidden="true"
        ></div>
        <span 
          className={`font-medium tabular-nums ${
            isExpired ? 'text-red-600' : isLowTime ? 'text-yellow-600' : 'text-gray-600'
          }`}
        >
          <span className="sr-only">{timeAnnouncement}</span>
          <span aria-hidden="true">
            Time Left: {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
        </span>
      </div>

      {/* Popup Modal - Enhanced with accessibility */}
      {showPopup && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="timer-expired-title"
          aria-describedby="timer-expired-description"
        >
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 text-center shadow-2xl">
            <div className="mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg 
                  className="w-8 h-8 text-red-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 
                id="timer-expired-title"
                className="text-xl font-bold text-gray-900 mb-2"
              >
                Time's Up!
              </h3>
              <p 
                id="timer-expired-description"
                className="text-gray-600 mb-6"
              >
                15 minutes is up, please exit changeroom
              </p>
            </div>
            <button
              onClick={() => setShowPopup(false)}
              className="px-6 py-2 bg-[#4A3A2E] hover:bg-[#3B2A21] text-white font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#4A3A2E] focus:ring-offset-2"
              autoFocus
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}

