"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { VestiaAPI, SavedOutfit } from "@/lib/api";

const CATEGORY_ORDER = ["top", "bottom", "shoes", "accessory"] as const;
const CATEGORY_LABEL: Record<string, string> = {
  top: "Top",
  bottom: "Bottom",
  shoes: "Shoes",
  accessory: "Accessory",
};

export default function OutfitSharePage() {
  const params = useParams();
  const shareCode = params?.shareCode as string;

  const [outfit, setOutfit] = useState<SavedOutfit | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!shareCode) return;
    VestiaAPI.getOutfit(shareCode)
      .then(setOutfit)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [shareCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5E9DA] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#4A3A2E]/20 border-t-[#4A3A2E] rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !outfit) {
    return (
      <div className="min-h-screen bg-[#F5E9DA] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#E5D5C8] rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">👗</span>
          </div>
          <h1 className="text-2xl font-bold text-[#3B2A21] mb-2">Outfit not found</h1>
          <p className="text-[#8C6A4B]">This outfit code may have expired or been mistyped.</p>
          <p className="mt-2 text-sm text-[#8C6A4B] font-mono tracking-widest">{shareCode}</p>
        </div>
      </div>
    );
  }

  // Sort items by canonical category order
  const sortedItems = [...outfit.items].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category as typeof CATEGORY_ORDER[number]);
    const bi = CATEGORY_ORDER.indexOf(b.category as typeof CATEGORY_ORDER[number]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const totalPrice = sortedItems.reduce((sum, item) => sum + (item.price || 0), 0);

  return (
    <div className="min-h-screen bg-[#F5E9DA]">
      {/* Header */}
      <div className="bg-[#FDF7EF] border-b border-[#E5D5C8] px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <Image src="/images/Logo.png" alt="Vestia" fill className="object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#3B2A21]">Vestia</h1>
              <p className="text-xs text-[#8C6A4B]">Smart Fitting Room</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#8C6A4B] uppercase tracking-wide">Outfit Code</p>
            <p className="text-lg font-bold tracking-[0.2em] text-[#4A3A2E]">{shareCode}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-6 py-8 flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[#3B2A21] mb-1">Your Saved Outfit</h2>
          <p className="text-[#8C6A4B] text-sm">
            Curated from your fitting room session
            {outfit.createdAt && ` · ${new Date(outfit.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`}
          </p>
        </div>

        {/* Outfit Grid */}
        <div className="grid grid-cols-2 gap-4">
          {sortedItems.map((item) => (
            <div
              key={item.productId}
              className={`bg-white rounded-2xl overflow-hidden shadow-sm border-2 ${
                item.source === "room" ? "border-emerald-300" : "border-[#E5D5C8]"
              }`}
            >
              {/* Image */}
              <div className="w-full h-48 bg-[#E5D5C8] relative overflow-hidden">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-[#3B2A21]/30 text-sm">No image</span>
                  </div>
                )}
                {/* Source badge */}
                <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                  item.source === "room"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-white/90 text-[#4A3A2E]"
                }`}>
                  {item.source === "room" ? "Tried On" : "Suggested"}
                </div>
              </div>

              {/* Details */}
              <div className="p-4">
                <p className="text-xs font-semibold text-[#8C6A4B] uppercase tracking-wide mb-1">
                  {CATEGORY_LABEL[item.category] || item.category}
                </p>
                <h3 className="font-semibold text-[#3B2A21] text-sm leading-tight mb-2 line-clamp-2">
                  {item.name}
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-1 bg-[#F5E9DA] text-[#3B2A21] rounded-full capitalize">
                    {item.color}
                  </span>
                  <span className="text-sm font-bold text-[#3B2A21]">${item.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5D5C8] flex items-center justify-between">
          <div>
            <p className="text-sm text-[#8C6A4B]">Full outfit</p>
            <p className="text-xs text-[#8C6A4B] mt-0.5">{sortedItems.length} items</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#8C6A4B] mb-0.5">Total</p>
            <p className="text-2xl font-bold text-[#3B2A21]">${totalPrice}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-4">
          <p className="text-xs text-[#8C6A4B]">
            Created with Vestia — The Smart Fitting Room Experience
          </p>
        </div>
      </div>
    </div>
  );
}
