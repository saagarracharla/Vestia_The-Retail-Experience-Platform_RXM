"use client";

import React, { useMemo } from "react";
import {
  generateHeatmapData,
  getHeatColor,
  groupByZone,
} from "@/lib/heatmap";

interface Scan {
  sku: string;
  zoneId?: string;
  productName?: string;
}

interface HeatmapProps {
  scans: Scan[];
  title?: string;
}

export default function StoreHeatmap({
  scans,
  title = "Store Activity Heatmap",
}: HeatmapProps) {
  const heatmapData = useMemo(() => {
    const validScans = scans.filter(s => s.zoneId);
    const zoneScans = groupByZone(validScans);
    return generateHeatmapData(zoneScans);
  }, [scans]);

  const totalScans = scans.filter(s => s.zoneId).length;
  const sortedZones = [...heatmapData].sort((a, b) => (b.scanCount || 0) - (a.scanCount || 0));

  // Map zone IDs to floorplan positions (SVG coordinates)
  const zonePositions: Record<string, { x: number; y: number; label: string }> = {
    Z1: { x: 80, y: 60, label: "Entrance\nAccessories" },
    Z2_T: { x: 140, y: 200, label: "Men's\nTopwear" },
    Z2_B: { x: 280, y: 200, label: "Men's\nBottomwear" },
    Z3_T: { x: 420, y: 200, label: "Women's\nTopwear" },
    Z3_B: { x: 540, y: 200, label: "Women's\nBottomwear" },
    Z4: { x: 360, y: 100, label: "Kids &\nTeens" },
    Z5: { x: 620, y: 100, label: "Footwear" },
    Z6: { x: 80, y: 140, label: "Accessories\n& Bags" },
    Z0: { x: 350, y: 280, label: "Unassigned" },
  };

  return (
    <div className="rounded-3xl border border-[#E5D5C8] bg-gradient-to-br from-[#FDF7EF] to-[#F5EDE0] p-8 shadow-lg">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-black text-[#1C1007] mb-2">{title}</h2>
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-black text-[#C17B3E]">{totalScans}</span>
          <span className="text-sm text-[#8C6A4B]">items scanned</span>
        </div>
      </div>

      {totalScans === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-[#E5D5C8] bg-white/50 py-16">
          <div className="text-center">
            <div className="mb-3 text-4xl">📍</div>
            <p className="text-center text-[#8C6A4B] font-medium">
              No activity yet. Start scanning items to see the heatmap.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Legend */}
          <div className="mb-8 flex items-center justify-center gap-6">
            {[
              { intensity: 0.1, label: "Low" },
              { intensity: 0.4, label: "Medium" },
              { intensity: 0.7, label: "High" },
              { intensity: 1.0, label: "Peak" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full shadow-sm"
                  style={{ backgroundColor: getHeatColor(item.intensity) }}
                />
                <span className="text-xs font-medium text-[#8C6A4B]">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Store Floorplan with Circular Heatmap */}
          <div className="mb-10 flex justify-center overflow-x-auto rounded-2xl border border-[#E5D5C8] bg-white p-4">
            <svg
              width={700}
              height={360}
              viewBox="0 0 700 360"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-lg"
            >
              {/* Store outline/background */}
              <defs>
                <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E5D5C8" strokeWidth="0.5" opacity="0.3" />
                </pattern>
              </defs>

              {/* Store background */}
              <rect x="20" y="20" width="660" height="320" fill="#F5F1ED" stroke="#8C6A4B" strokeWidth="3" rx="8" />
              <rect x="20" y="20" width="660" height="320" fill="url(#gridPattern)" opacity="0.5" />

              {/* Entrance */}
              <rect x="20" y="20" width="660" height="40" fill="#C17B3E" opacity="0.1" stroke="#C17B3E" strokeWidth="1" strokeDasharray="5,5" />
              <text x="350" y="40" textAnchor="middle" fontSize="11" fill="#8C6A4B" fontWeight="bold">ENTRANCE</text>

              {/* Render zones as circles on floorplan */}
              {heatmapData.map((zone) => {
                const pos = zonePositions[zone.zoneId];
                if (!pos) return null;

                const radius = 32;
                const opacity = 0.45 + zone.heatIntensity * 0.5;

                return (
                  <g key={zone.zoneId}>
                    {/* Outer glow */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={radius + 10}
                      fill={zone.color}
                      opacity={zone.heatIntensity * 0.15}
                    />

                    {/* Main zone circle */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={radius}
                      fill={zone.color}
                      opacity={opacity}
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                    />

                    {/* Inner border */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={radius}
                      fill="none"
                      stroke="#8C6A4B"
                      strokeWidth="1"
                      opacity="0.3"
                    />

                    {/* Count badge */}
                    {(zone.scanCount ?? 0) > 0 && (
                      <g>
                        <circle
                          cx={pos.x + 25}
                          cy={pos.y - 25}
                          r="14"
                          fill="#1C1007"
                          opacity="0.95"
                        />
                        <text
                          x={pos.x + 25}
                          y={pos.y - 20}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="11"
                          fontWeight="bold"
                          fill="#FFFFFF"
                        >
                          {zone.scanCount}
                        </text>
                      </g>
                    )}

                    {/* Zone label below circle */}
                    <text
                      x={pos.x}
                      y={pos.y + radius + 25}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#1C1007"
                      fontWeight="600"
                    >
                      {pos.label.split("\n").map((line, i) => (
                        <tspan key={i} x={pos.x} dy={i === 0 ? 0 : 11}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  </g>
                );
              })}

              {/* Checkout counter indicator */}
              <rect x="620" y="300" width="60" height="30" fill="#8C6A4B" opacity="0.2" rx="4" />
              <text x="650" y="320" textAnchor="middle" fontSize="9" fill="#8C6A4B" fontWeight="bold">
                CHECKOUT
              </text>
            </svg>
          </div>

          {/* Zone Breakdown - Compact Cards */}
          <div className="mb-6">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[#8C6A4B]">
              Zone Activity Ranking
            </h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {sortedZones
                .filter((z) => (z.scanCount ?? 0) > 0)
                .map((zone, rank) => {
                  const percentage = totalScans > 0 ? Math.round(((zone.scanCount ?? 0) / totalScans) * 100) : 0;
                  return (
                    <div
                      key={zone.zoneId}
                      className="group relative rounded-xl border border-[#E5D5C8] bg-white p-3 transition-all hover:shadow-md"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full shadow-sm"
                          style={{ backgroundColor: zone.color }}
                        />
                        <span className="text-xs font-bold text-[#8C6A4B]">#{rank + 1}</span>
                      </div>
                      <p className="mb-1 line-clamp-2 text-xs font-semibold text-[#1C1007]">
                        {zone.zoneName}
                      </p>
                      <div className="space-y-1">
                        <div className="w-full bg-[#F0E0CC] rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${((zone.scanCount ?? 0) / Math.max(...sortedZones.map(z => z.scanCount ?? 0))) * 100}%`,
                              backgroundColor: zone.color,
                            }}
                          />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs font-bold text-[#1C1007]">{zone.scanCount}</span>
                          <span className="text-xs text-[#8C6A4B]">{percentage}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Insights */}
          <div className="rounded-xl border border-[#E5D5C8] bg-[#4A3A2E]/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#8C6A4B] mb-2">
              Insight
            </p>
            {(sortedZones[0]?.scanCount ?? 0) > 0 && (
              <p className="text-sm text-[#1C1007]">
                <span className="font-bold">{sortedZones[0].zoneName}</span> leads with{" "}
                <span className="font-bold text-[#C17B3E]">
                  {Math.round(((sortedZones[0]?.scanCount ?? 0) / totalScans) * 100)}%
                </span>{" "}
                of all scans.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
