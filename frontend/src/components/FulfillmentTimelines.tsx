"use client";

import { AnalyticsData } from "@/lib/api";

interface FulfillmentTimelinesProps {
  data: AnalyticsData;
}

function formatMinutes(seconds: number | undefined | null): string {
  if (!seconds || isNaN(seconds) || seconds === 0) return "—";
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

export default function FulfillmentTimelines({
  data,
}: FulfillmentTimelinesProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FDF7EF] to-[#F5E9DA] rounded-3xl border border-[#E5D5C8] p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C17B3E] mb-2">
              REQUEST FULFILLMENT FLOW
            </p>
            <h2 className="text-3xl font-black text-[#1C1007] mb-2">
              From Request to Delivery
            </h2>
            <p className="text-sm text-[#8C6A4B] max-w-2xl">
              Track how long it takes for customer requests to move through each
              stage of the fulfillment process
            </p>
          </div>
          <div className="flex-shrink-0">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-[#8C6A4B] mb-1">
                Avg Total Time
              </p>
              <p className="text-3xl font-black text-[#4A3A2E]">
                {formatMinutes(data.avgFulfillmentSeconds)}
              </p>
              <p className="text-xs text-[#8C6A4B] mt-1">
                {data.requestFulfillmentRate}% delivered
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
