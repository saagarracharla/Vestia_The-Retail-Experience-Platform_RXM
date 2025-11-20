"use client";

import { useState, useEffect } from "react";

interface SessionTimerProps {
  startTime: Date | null;
}

export default function SessionTimer({ startTime }: SessionTimerProps) {
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes in seconds
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    if (!startTime) {
      setTimeLeft(15 * 60);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      const remaining = Math.max(0, (15 * 60) - elapsed);
      
      setTimeLeft(remaining);
      
      // Show popup when time is up
      if (remaining === 0 && !showPopup) {
        setShowPopup(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startTime, showPopup]);

  if (!startTime) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLowTime = timeLeft <= 300; // Last 5 minutes

  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <div className={`w-2 h-2 rounded-full animate-pulse ${
          timeLeft === 0 ? 'bg-red-500' : isLowTime ? 'bg-yellow-500' : 'bg-emerald-500'
        }`}></div>
        <span className={`font-medium ${
          timeLeft === 0 ? 'text-red-600' : isLowTime ? 'text-yellow-600' : 'text-gray-600'
        }`}>
          Time Left: {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
      </div>

      {/* Popup Modal */}
      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Time's Up!</h3>
            <p className="text-gray-600 mb-6">
              15 minutes is up, please exit changeroom
            </p>
            <button
              onClick={() => setShowPopup(false)}
              className="px-6 py-2 bg-[#4A3A2E] hover:bg-[#3B2A21] text-white font-medium rounded-lg transition-all"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}

