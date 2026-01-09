"use client";

import { ItemWithProduct } from "@/lib/api";

interface ItemCardProps {
  item: ItemWithProduct;
  onRequestSize: (item: ItemWithProduct) => void;
  onLeaveFeedback: (item: ItemWithProduct) => void;
}

export default function ItemCard({
  item,
  onRequestSize,
  onLeaveFeedback,
}: ItemCardProps) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 group">
      {/* Image */}
      <div className="w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative overflow-hidden">
        {item.product?.imageUrl ? (
          <img
            src={item.product.imageUrl}
            alt={item.product.name || 'Product'}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`absolute inset-0 flex items-center justify-center ${item.product?.imageUrl ? 'hidden' : ''}`}>
          <svg
            className="w-24 h-24 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          {item.product?.name || 'Unknown Product'}
        </h3>
        <div className="space-y-1 mb-4">
          <p className="text-sm text-gray-600">SKU: {item.sku}</p>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              {item.derivedColor || item.product?.color || 'Unknown Color'}
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-sm font-medium text-gray-700">
              {item.derivedSize ? `Size ${item.derivedSize}` : 'Size N/A'}
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-sm font-medium text-gray-700">
              ${item.product?.price || 'N/A'}
            </span>
          </div>
          {item.isDelivered && (
            <div className="flex items-center gap-1 text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs font-medium">Delivered by staff</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onRequestSize(item)}
            className="w-full bg-[#0066CC] hover:bg-[#0052A3] text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 text-sm shadow-sm hover:shadow-md"
          >
            Request Different Size/Color
          </button>
          <button
            onClick={() => onLeaveFeedback(item)}
            className="w-full bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-all duration-200 text-sm"
          >
            Leave Feedback
          </button>
        </div>
      </div>
    </div>
  );
}
