"use client";

import { useRouter } from "next/navigation";
import { generateSessionId } from "@/utils/sessionId";

export default function WelcomeScreen() {
  const router = useRouter();

  function handleStart() {
    const sessionId = generateSessionId();
    const startTime = new Date();
    localStorage.setItem("sessionId", sessionId);
    localStorage.setItem("sessionStartTime", startTime.toISOString());
    router.push("/kiosk/session");
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
      <div className="text-center px-6 max-w-2xl">
        {/* Main Title with Animation */}
        <h1 className="text-6xl md:text-7xl font-bold text-gray-900 mb-4 animate-fade-in-up">
          Welcome to Vestia
        </h1>
        
        {/* Subtitle with Animation */}
        <p className="text-xl md:text-2xl text-gray-600 mb-12 animate-fade-in-up-delay">
          Smart fitting room experience.
        </p>
        
        {/* CTA Button with Animation */}
        <button
          onClick={handleStart}
          className="px-10 py-4 bg-[#0066CC] hover:bg-[#0052A3] text-white font-semibold text-lg rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 animate-fade-in-up-delay-2"
        >
          Start scanning now
        </button>
      </div>
    </div>
  );
}

