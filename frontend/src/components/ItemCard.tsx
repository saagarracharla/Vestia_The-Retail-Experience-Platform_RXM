"use client";

interface Item {
  sku: string;
  name: string;
  color: string;
  size: string;
}

interface ItemCardProps {
  item: Item;
  onRequestSize: (item: Item) => void;
  onLeaveFeedback: (item: Item) => void;
}

export default function ItemCard({
  item,
  onRequestSize,
  onLeaveFeedback,
}: ItemCardProps) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 group">
      {/* Image Placeholder */}
      <div className="w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gray-300 opacity-20 group-hover:opacity-30 transition-opacity"></div>
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

      {/* Product Info */}
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          {item.name}
        </h3>
        <div className="space-y-1 mb-4">
          <p className="text-sm text-gray-600">SKU: {item.sku}</p>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              {item.color}
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-sm font-medium text-gray-700">
              Size {item.size}
            </span>
          </div>
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
