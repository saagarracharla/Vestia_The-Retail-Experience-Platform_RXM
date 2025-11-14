const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());

let sessions = {};   
let requests = [];  
let feedbacks = []; 
let nextRequestId = 1;

// ==================== MOCK POLYVORE-STYLE CATALOG ====================
// Based on Polyvore dataset structure with categoryid mapping
const CATEGORY_MAPPING = {
  1: "top",
  2: "bottom", 
  3: "shoes",
  4: "outerwear",
  5: "accessories"
};

const COLOR_FAMILIES = {
  "blue": ["navy", "royal blue", "sky blue", "denim"],
  "black": ["black", "charcoal"],
  "white": ["white", "ivory", "cream"],
  "neutral": ["beige", "tan", "khaki", "grey", "gray"],
  "brown": ["brown", "chocolate", "caramel"],
  "red": ["red", "burgundy", "maroon"]
};

// Mock catalog following Polyvore structure
const mockCatalog = [
  {
    sku: "119704139_1",
    name: "Classic Blue Slim-Fit Oxford Shirt",
    price: 45.99,
    categoryid: 1,
    category: "top",
    brand: "Zara",
    colorFamily: "blue",
    styleTags: ["slim-fit", "casual", "oxford"],
    inStock: true,
    storeId: "STORE-001",
    image: "/images/119704139_1.jpg",
    likes: 234
  },
  {
    sku: "119704139_2",
    name: "Navy Blue Crew Neck T-Shirt",
    price: 29.99,
    categoryid: 1,
    category: "top",
    brand: "H&M",
    colorFamily: "blue",
    styleTags: ["casual", "basic"],
    inStock: true,
    storeId: "STORE-001",
    image: "/images/119704139_2.jpg",
    likes: 156
  },
  {
    sku: "120556789_1",
    name: "Slim-Fit Khaki Chinos",
    price: 79.99,
    categoryid: 2,
    category: "bottom",
    brand: "Levi's",
    colorFamily: "neutral",
    styleTags: ["slim-fit", "casual", "chinos"],
    inStock: true,
    storeId: "STORE-001",
    image: "/images/120556789_1.jpg",
    likes: 412
  },
  {
    sku: "120556789_2",
    name: "Black Skinny Jeans",
    price: 89.99,
    categoryid: 2,
    category: "bottom",
    brand: "Levi's",
    colorFamily: "black",
    styleTags: ["skinny", "casual", "denim"],
    inStock: true,
    storeId: "STORE-001",
    image: "/images/120556789_2.jpg",
    likes: 523
  },
  {
    sku: "120556789_3",
    name: "Grey Dress Pants",
    price: 95.00,
    categoryid: 2,
    category: "bottom",
    brand: "Zara",
    colorFamily: "neutral",
    styleTags: ["slim-fit", "formal", "dress"],
    inStock: true,
    storeId: "STORE-001",
    image: "/images/120556789_3.jpg",
    likes: 298
  },
  {
    sku: "121445678_1",
    name: "White Leather Sneakers",
    price: 119.99,
    categoryid: 3,
    category: "shoes",
    brand: "Nike",
    colorFamily: "white",
    styleTags: ["casual", "athletic", "sneakers"],
    inStock: true,
    storeId: "STORE-001",
    image: "/images/121445678_1.jpg",
    likes: 891
  },
  {
    sku: "121445678_2",
    name: "Black Running Shoes",
    price: 109.99,
    categoryid: 3,
    category: "shoes",
    brand: "Adidas",
    colorFamily: "black",
    styleTags: ["casual", "athletic", "running"],
    inStock: true,
    storeId: "STORE-001",
    image: "/images/121445678_2.jpg",
    likes: 667
  },
  {
    sku: "121445678_3",
    name: "Brown Leather Loafers",
    price: 129.99,
    categoryid: 3,
    category: "shoes",
    brand: "Clarks",
    colorFamily: "brown",
    styleTags: ["formal", "leather", "loafers"],
    inStock: true,
    storeId: "STORE-001",
    image: "/images/121445678_3.jpg",
    likes: 445
  },
  {
    sku: "122334455_1",
    name: "Navy Blazer",
    price: 189.99,
    categoryid: 4,
    category: "outerwear",
    brand: "Zara",
    colorFamily: "blue",
    styleTags: ["formal", "blazer", "slim-fit"],
    inStock: true,
    storeId: "STORE-001",
    image: "/images/122334455_1.jpg",
    likes: 712
  }
];

// Mock customer profiles
const customerProfiles = {
  "CUST-123": {
    customerId: "CUST-123",
    preferredColors: { neutral: 5, blue: 3, black: 2 },
    brandAffinity: { Zara: 4, "Levi's": 2, Nike: 1 },
    avgPriceSpent: 75.0,
    priceStdDev: 30.0,
    preferredStyles: { "slim-fit": 6, casual: 8, formal: 2 }
  }
};

// ==================== RECOMMENDATION ENGINE ====================

// Color compatibility matrix
const COLOR_COMPATIBILITY = {
  "blue-neutral": 0.95,
  "blue-white": 0.90,
  "blue-black": 0.85,
  "blue-brown": 0.70,
  "black-neutral": 0.95,
  "black-white": 0.90,
  "black-grey": 0.85,
  "neutral-white": 0.95,
  "neutral-brown": 0.90,
  "neutral-black": 0.85,
  "white-blue": 0.90,
  "white-black": 0.90,
  "white-neutral": 0.95,
  "grey-blue": 0.85,
  "grey-black": 0.85,
  "brown-neutral": 0.90,
  "brown-white": 0.80,
  "black-black": 0.80,
  "white-white": 0.75,
  "neutral-neutral": 0.85,
  "blue-blue": 0.70
};

const WEIGHTS = {
  color: 0.35,
  brand: 0.25,
  price: 0.25,
  style: 0.15
};

function colorCompatibilityScore(color1, color2) {
  const key1 = `${color1.toLowerCase()}-${color2.toLowerCase()}`;
  const key2 = `${color2.toLowerCase()}-${color1.toLowerCase()}`;
  return COLOR_COMPATIBILITY[key1] || COLOR_COMPATIBILITY[key2] || 0.6;
}

function brandAffinityScore(brand, profile) {
  if (!profile || !profile.brandAffinity) return 0.5;
  
  const totalPurchases = Object.values(profile.brandAffinity).reduce((sum, count) => sum + count, 0);
  const brandPurchases = profile.brandAffinity[brand] || 0;
  
  if (totalPurchases === 0) return 0.5;
  
  const affinityRatio = brandPurchases / totalPurchases;
  return Math.min(1.0, affinityRatio * 2.5);
}

function priceClosenessScore(candidatePrice, profile) {
  const avgPrice = profile?.avgPriceSpent || 50.0;
  const stdDev = Math.max(profile?.priceStdDev || 30.0, 10.0);
  
  const zScore = Math.abs(candidatePrice - avgPrice) / stdDev;
  return Math.exp(-0.5 * Math.pow(zScore, 2));
}

function styleOverlapScore(baseTags, candidateTags, profile) {
  if (!baseTags.length && !candidateTags.length) return 0.5;
  
  const baseSet = new Set(baseTags.map(t => t.toLowerCase()));
  const candidateSet = new Set(candidateTags.map(t => t.toLowerCase()));
  
  let overlapScore = 0.3;
  if (baseSet.size > 0 || candidateSet.size > 0) {
    const intersection = new Set([...baseSet].filter(t => candidateSet.has(t)));
    const union = new Set([...baseSet, ...candidateSet]);
    overlapScore = union.size > 0 ? intersection.size / union.size : 0;
  }
  
  let preferenceBoost = 0.0;
  if (profile?.preferredStyles) {
    const totalStyleCount = Object.values(profile.preferredStyles).reduce((sum, c) => sum + c, 0);
    if (totalStyleCount > 0) {
      for (const tag of candidateTags) {
        const tagCount = profile.preferredStyles[tag.toLowerCase()] || 0;
        preferenceBoost += (tagCount / totalStyleCount) * 0.3;
      }
    }
  }
  
  return Math.min(1.0, overlapScore + preferenceBoost);
}

function calculateScore(baseItem, candidate, profile) {
  const colorScore = colorCompatibilityScore(baseItem.colorFamily, candidate.colorFamily);
  const brandScore = brandAffinityScore(candidate.brand, profile);
  const priceScore = priceClosenessScore(candidate.price, profile);
  const styleScore = styleOverlapScore(baseItem.styleTags, candidate.styleTags, profile);
  
  const total =
    WEIGHTS.color * colorScore +
    WEIGHTS.brand * brandScore +
    WEIGHTS.price * priceScore +
    WEIGHTS.style * styleScore;
  
  return Math.round(total * 1000) / 1000;
}

function getScoreBreakdown(baseItem, candidate, profile) {
  return {
    colorCompatibility: Math.round(colorCompatibilityScore(baseItem.colorFamily, candidate.colorFamily) * 1000) / 1000,
    brandAffinity: Math.round(brandAffinityScore(candidate.brand, profile) * 1000) / 1000,
    priceCloseness: Math.round(priceClosenessScore(candidate.price, profile) * 1000) / 1000,
    styleOverlap: Math.round(styleOverlapScore(baseItem.styleTags, candidate.styleTags, profile) * 1000) / 1000
  };
}

function getRecommendations(baseItem, catalog, customerProfile, targetCategories, topK = 3) {
  const recommendations = {};
  
  for (const category of targetCategories) {
    // Filter candidates
    const candidates = catalog.filter(
      p => p.inStock && 
           p.storeId === baseItem.storeId && 
           p.category === category && 
           p.category !== baseItem.category
    );
    
    // Score each candidate
    const scored = candidates.map(candidate => {
      const score = calculateScore(baseItem, candidate, customerProfile);
      const scoreBreakdown = getScoreBreakdown(baseItem, candidate, customerProfile);
      
      return {
        sku: candidate.sku,
        name: candidate.name,
        brand: candidate.brand,
        price: candidate.price,
        color: candidate.colorFamily,
        styleTags: candidate.styleTags,
        image: candidate.image,
        categoryid: candidate.categoryid,
        likes: candidate.likes,
        score,
        scoreBreakdown
      };
    });
    
    // Sort and take top K
    scored.sort((a, b) => b.score - a.score);
    recommendations[category] = scored.slice(0, topK);
  }
  
  return recommendations;
}

// ==================== EXISTING ENDPOINTS ====================

// P0 ChangeRoom Session
app.post("/api/session/scan", (req, res) => {
  const { sessionId, sku, name, color, size } = req.body;
  if (!sessionId || !sku) {
    return res.status(400).json({ error: "sessionId and sku are required" });
  }
  if (!sessions[sessionId]) {
    sessions[sessionId] = { items: [] };
  }
  sessions[sessionId].items.push({ sku, name, color, size });
  res.json({
    sessionId,
    items: sessions[sessionId].items,
  });
});

app.get("/api/session/:id", (req, res) => {
  const sessionId = req.params.id;
  const session = sessions[sessionId] || { items: [] };
  res.json(session);
});

// P0 ChangeRoom Requests
app.post("/api/request", (req, res) => {
  const { sessionId, sku, requestedSize, requestedColor } = req.body;
  if (!sessionId || !sku) {
    return res.status(400).json({ error: "sessionId and sku are required" });
  }
  const request = {
    id: nextRequestId++,
    sessionId,
    sku,
    requestedSize: requestedSize || null,
    requestedColor: requestedColor || null,
    status: "Queued",
    timestamp: new Date().toISOString()
  };
  requests.push(request);
  res.json(request);
});

app.get("/api/requests", (req, res) => {
  res.json(requests);
});

app.post("/api/request/:id/status", (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body; 
  const request = requests.find((r) => r.id === id);
  if (!request) {
    return res.status(404).json({ error: "Request not found" });
  }
  request.status = status;
  res.json(request);
});

// P0 ChangeRoom Feedback
app.post("/api/feedback", (req, res) => {
  const { sessionId, rating, comment } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }
  feedbacks.push({
    sessionId,
    rating: Number(rating) || 0,
    comment: comment || "",
    timestamp: new Date().toISOString()
  });
  res.json({ success: true });
});

// P1 Retail Analytics
app.get("/api/analytics", (req, res) => {
  const totalSessions = Object.keys(sessions).length;
  const totalRequests = requests.length;
  const avgRating =
    feedbacks.length > 0
      ? feedbacks.reduce((sum, f) => sum + (f.rating || 0), 0) / feedbacks.length
      : 0;
  res.json({
    totalSessions,
    totalRequests,
    avgRating,
    totalFeedbacks: feedbacks.length
  });
});

// ==================== P1 RULE-BASED RECOMMENDATIONS ====================

/**
 * POST /api/recommendations
 * Get outfit recommendations based on a base item
 * 
 * Body:
 * {
 *   baseSku: string (required)
 *   storeId: string (default: "STORE-001")
 *   customerId: string (optional, for personalization)
 *   targetCategories: string[] (e.g., ["bottom", "shoes"])
 *   topK: number (default: 3)
 * }
 */
app.post("/api/recommendations", (req, res) => {
  try {
    const {
      baseSku,
      storeId = "STORE-001",
      customerId,
      targetCategories = ["bottom", "shoes"],
      topK = 3
    } = req.body;

    // Validate
    if (!baseSku) {
      return res.status(400).json({ error: "baseSku is required" });
    }

    // Find base item
    const baseItem = mockCatalog.find(p => p.sku === baseSku && p.storeId === storeId);
    if (!baseItem) {
      return res.status(404).json({ error: "Base item not found in catalog" });
    }

    // Get customer profile (if logged in)
    const customerProfile = customerId ? customerProfiles[customerId] : null;

    // Generate recommendations
    const recommendations = getRecommendations(
      baseItem,
      mockCatalog,
      customerProfile,
      targetCategories,
      topK
    );

    // Response
    res.json({
      sessionId: req.headers['x-session-id'] || `session-${Date.now()}`,
      baseItem: {
        sku: baseItem.sku,
        name: baseItem.name,
        brand: baseItem.brand,
        price: baseItem.price,
        category: baseItem.category,
        color: baseItem.colorFamily,
        image: baseItem.image
      },
      recommendations,
      customerPersonalized: !!customerId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/catalog
 * Get all available items in catalog (for testing/debugging)
 */
app.get("/api/catalog", (req, res) => {
  const { storeId = "STORE-001", category } = req.query;
  
  let filtered = mockCatalog.filter(p => p.storeId === storeId);
  if (category) {
    filtered = filtered.filter(p => p.category === category);
  }
  
  res.json({
    storeId,
    totalItems: filtered.length,
    items: filtered
  });
});

/**
 * GET /api/catalog/:sku
 * Get specific item details
 */
app.get("/api/catalog/:sku", (req, res) => {
  const { sku } = req.params;
  const item = mockCatalog.find(p => p.sku === sku);
  
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }
  
  res.json(item);
});

// ==================== SERVER ====================

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  POST /api/recommendations - Get outfit recommendations`);
  console.log(`  GET  /api/catalog - View all catalog items`);
  console.log(`  GET  /api/catalog/:sku - Get item details`);
  console.log(`  POST /api/session/scan - Scan item into session`);
  console.log(`  GET  /api/session/:id - Get session details`);
  console.log(`  POST /api/request - Create size/color request`);
  console.log(`  GET  /api/requests - View all requests`);
  console.log(`  POST /api/request/:id/status - Update request status`);
  console.log(`  POST /api/feedback - Submit feedback`);
  console.log(`  GET  /api/analytics - View analytics\n`);
});