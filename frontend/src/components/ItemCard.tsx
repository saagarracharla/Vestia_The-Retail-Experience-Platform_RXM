"use client";

import { ItemWithProduct } from "@/lib/api";

interface ItemCardProps {
  item: ItemWithProduct;
  onRequestSize: (item: ItemWithProduct) => void;
  onLeaveFeedback: (item: ItemWithProduct) => void;
}

export default function ItemCard({ item, onRequestSize, onLeaveFeedback }: ItemCardProps) {
  return (
    <div className="group bg-[#FDF7EF] rounded-2xl overflow-hidden border border-[#E5D5C8] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      {/* Image */}
      <div className="relative w-full h-64 bg-gradient-to-br from-[#E5D5C8] to-[#D4C4B5] overflow-hidden">
        {item.product?.imageUrl ? (
          <img
            src={item.product.imageUrl}
            alt={item.product.name || "Product"}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div className={`absolute inset-0 flex items-center justify-center ${item.product?.imageUrl ? "hidden" : ""}`}>
          <span className="text-[#8C6A4B] text-4xl opacity-30">◻</span>
        </div>

        {/* Price badge */}
        {item.product?.price && (
          <div className="absolute top-3 right-3 bg-[#1C1007]/80 text-white text-sm font-bold px-3 py-1 rounded-full backdrop-blur-sm">
            ${item.product.price}
          </div>
        )}

        {/* Delivered badge */}
        {item.isDelivered && (
          <div className="absolute bottom-3 left-3 bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
            <span>✓</span> Delivered
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-5">
        <h3 className="text-base font-semibold text-[#1C1007] mb-3 line-clamp-2 leading-snug">
          {item.product?.name || "Unknown Product"}
        </h3>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-3 py-1 bg-[#F5E9DA] text-[#4A3A2E] text-xs font-medium rounded-full border border-[#E5D5C8] capitalize">
            {item.derivedColor || item.product?.color || "—"}
          </span>
          <span className="px-3 py-1 bg-[#F5E9DA] text-[#4A3A2E] text-xs font-medium rounded-full border border-[#E5D5C8]">
            {item.derivedSize ? `Size ${item.derivedSize}` : item.product?.category || "—"}
          </span>
          <span className="px-3 py-1 bg-[#F5E9DA] text-[#8C6A4B] text-xs rounded-full border border-[#E5D5C8] font-mono">
            {item.sku}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onRequestSize(item)}
            className="w-full py-3 px-4 bg-[#4A3A2E] hover:bg-[#3B2A21] text-[#FDF7EF] text-sm font-semibold rounded-xl transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
          >
            Request Size / Color
          </button>
          <button
            onClick={() => onLeaveFeedback(item)}
            className="w-full py-3 px-4 border-2 border-[#E5D5C8] hover:border-[#4A3A2E] text-[#4A3A2E] text-sm font-semibold rounded-xl transition-all duration-200 hover:bg-[#F5E9DA] active:scale-[0.98]"
          >
            Leave Feedback
          </button>
        </div>
      </div>
    </div>
  );
}
