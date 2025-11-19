"use client";

export default function ColourDot({ color, label }: { color: string; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-full shadow-inner"
        style={{ background: color }}
        title={label}
      />
    </div>
  );
}
