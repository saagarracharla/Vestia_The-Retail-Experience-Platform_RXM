"use client";

import { useEffect } from "react";

interface NotificationProps {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
  duration?: number;
}

export default function Notification({ message, type, onClose, duration = 5000 }: NotificationProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const styles = {
    success: {
      bg: "bg-gradient-to-r from-emerald-50 to-green-50",
      border: "border-emerald-200",
      icon: "✓",
      iconBg: "bg-emerald-500",
      text: "text-emerald-800"
    },
    error: {
      bg: "bg-gradient-to-r from-red-50 to-rose-50", 
      border: "border-red-200",
      icon: "✕",
      iconBg: "bg-red-500",
      text: "text-red-800"
    },
    info: {
      bg: "bg-gradient-to-r from-blue-50 to-indigo-50",
      border: "border-blue-200", 
      icon: "ℹ",
      iconBg: "bg-blue-500",
      text: "text-blue-800"
    }
  }[type];

  return (
    <div className="fixed top-6 right-6 z-50 animate-slide-in-elegant">
      <div className={`${styles.bg} ${styles.border} border-2 rounded-2xl shadow-2xl backdrop-blur-sm max-w-sm overflow-hidden`}>
        {/* Elegant top accent bar */}
        <div className={`h-1 ${styles.iconBg} opacity-80`}></div>
        
        <div className="p-5">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className={`${styles.iconBg} w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg`}>
              {styles.icon}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`${styles.text} text-sm font-medium leading-relaxed`}>
                {message}
              </p>
            </div>
            
            {/* Close button */}
            <button
              onClick={onClose}
              className={`${styles.text} hover:opacity-70 transition-opacity ml-2 text-lg font-light flex-shrink-0`}
            >
              ×
            </button>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="h-1 bg-black/5">
          <div 
            className={`h-full ${styles.iconBg} opacity-60 animate-progress`}
            style={{ animationDuration: `${duration}ms` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
