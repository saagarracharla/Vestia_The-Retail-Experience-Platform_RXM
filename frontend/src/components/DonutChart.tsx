"use client";

import React from "react";

type Props = {
  labels?: string[];
  data?: number[];
  colors?: string[];
  size?: number;
};

// Lightweight SVG donut implementation (no external deps)
export default function DonutChart({ labels = [], data = [], colors = [], size = 110 }: Props) {
  const total = data.reduce((s, v) => s + (v || 0), 0);
  const radius = size / 2;
  const innerRadius = radius * 0.6;
  const cx = radius;
  const cy = radius;

  if (total === 0) {
    // render placeholder donut
    return (
      <div
        className="rounded-full bg-[#F3E9DF] flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <div className="w-10 h-10 rounded-full bg-[#DED1C3]" />
      </div>
    );
  }

  let cumulative = 0;

  function polarToCartesian(centerX: number, centerY: number, r: number, angleInDegrees: number) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians),
    };
  }

  function describeArc(x: number, y: number, r: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(x, y, r, endAngle);
    const end = polarToCartesian(x, y, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [`M ${start.x} ${start.y}`, `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`].join(" ");
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      <g>
        {data.map((value, i) => {
          const start = (cumulative / total) * 360;
          cumulative += value || 0;
          const end = (cumulative / total) * 360;
          const pathOuter = describeArc(cx, cy, radius - 1, start, end);
          const pathInner = describeArc(cx, cy, innerRadius, end, start);
          const d = `${pathOuter} L ${polarToCartesian(cx, cy, innerRadius, end).x} ${polarToCartesian(cx, cy, innerRadius, end).y} ${pathInner} Z`;
          const fill = colors && colors[i] ? colors[i] : ["#C7A070", "#7A6A5A", "#2E7D32"][i % 3];
          return <path key={i} d={d} fill={fill} stroke="#fff" strokeWidth={0.5} />;
        })}

        {/* center hole */}
        <circle cx={cx} cy={cy} r={innerRadius - 2} fill="#FDF6E6" />
      </g>
    </svg>
  );
}
