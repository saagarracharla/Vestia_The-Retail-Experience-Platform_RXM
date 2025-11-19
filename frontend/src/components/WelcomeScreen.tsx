"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Image from "next/image";
import { generateSessionId } from "@/utils/sessionId";

export default function WelcomeScreen() {
  const router = useRouter();

  // Clear all localStorage on component mount (dev restart)
  useEffect(() => {
    localStorage.clear();
  }, []);

  function handleStart() {
    const sessionId = generateSessionId();
    const startTime = new Date();
    localStorage.setItem("sessionId", sessionId);
    localStorage.setItem("sessionStartTime", startTime.toISOString());
    router.push("/kiosk/session");
  }

  // stub handlers for now – you can wire these later
  function handleSignIn() {
    console.log("TODO: go to sign in");
  }

  function handleCreateAccount() {
    console.log("TODO: go to create account");
  }

  function handleContinueAsGuest() {
    // could also call handleStart() if guest = direct to session
    handleStart();
  }

  return (
    <main className="min-h-screen bg-[#F5E7D7] flex items-center justify-center">
      {/* Outer card matching your Figma aspect ratio */}
      <div className="relative w-[1440px] h-[900px] rounded-[40px] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.25)] bg-[#FDF7EF]">
        {/* Background image from Figma */}
        <Image src="/images/VestiaWelcome.png" alt="Vestia" fill priority className="object-cover" />

        {/* Overlay buttons – positioned to sit over the Figma layout */}
        <div className="absolute left-29 bottom-37
         space-y-4">
          {/* Main CTA */}
          <button
            onClick={handleStart}
            className="rounded-xl bg-[#4A3A2E] text-[#FDF7EF] text-3xl font-semibold px-20 py-7 shadow-md hover:bg-[#3B2D22] transition"
          >
            Tap to scan your first item
          </button>

          {/* Secondary actions row */}
          <div className="flex flex-wrap gap-6 text-2xl text-[#4A3A2E] font-bold">
            <button
              onClick={handleSignIn}
              className="hover:underline"
            >
              Sign in
            </button>
            <button
              onClick={handleCreateAccount}
              className="hover:underline"
            >
              Create Account
            </button>
            <button
              onClick={handleContinueAsGuest}
              className="hover:underline"
            >
              Continue as Guest
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}