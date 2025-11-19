type ItemId = "TSHIRT" | "SHORTS" | "SNEAKERS" | "JACKET";

interface Item {
  id: ItemId;
  sku: string;
  name: string;
  size: string;
  imageUrl: string;
  price: string;
  description: string;
  recommendedIds: ItemId[];
}

const TSHIRT: Item = {
  id: "TSHIRT",
  sku: "111",
  name: "Oversized Cream T-Shirt",
  size: "M",
  imageUrl: "/items/tshirt.png",
  price: "$39.99",
  description: "Relaxed fit cream T-shirt, defaulting to size M for this demo.",
  recommendedIds: ["SHORTS", "SNEAKERS", "JACKET"]
};

const SHORTS: Item = {
  id: "SHORTS",
  sku: "222",
  name: "Black Tech Shorts",
  size: "M",
  imageUrl: "/items/shorts.png",
  price: "$49.99",
  description: "Lightweight tech shorts in size M for this demo.",
  recommendedIds: ["TSHIRT", "SNEAKERS", "JACKET"]
};

const SNEAKERS: Item = {
  id: "SNEAKERS",
  sku: "333",
  name: "White Minimal Sneakers",
  size: "9",
  imageUrl: "/items/sneakers.png",
  price: "$89.99",
  description: "Minimal white sneakers, shown in size 9.",
  recommendedIds: ["TSHIRT", "SHORTS", "JACKET"]
};

const JACKET: Item = {
  id: "JACKET",
  sku: "444",
  name: "Lightweight Denim Jacket",
  size: "M",
  imageUrl: "/items/jacket.png",
  price: "$79.99",
  description: "Light-wash denim jacket, defaulting to size M.",
  recommendedIds: ["TSHIRT", "SHORTS", "SNEAKERS"]
};

export const ITEMS: Record<ItemId, Item> = {
  TSHIRT,
  SHORTS,
  SNEAKERS,
  JACKET
};

export const ITEMS_BY_SKU: Record<string, Item> = {
  "111": TSHIRT,
  "222": SHORTS,
  "333": SNEAKERS,
  "444": JACKET
};

export type { ItemId, Item };
