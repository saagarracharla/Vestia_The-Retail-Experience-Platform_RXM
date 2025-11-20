const express = require("express");
const cors = require("cors");


const app = express();
app.use(cors());
app.use(express.json());

// Logging middleware to log all API calls
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Request body:", JSON.stringify(req.body, null, 2));
  }
  next();
});


let sessions = {};   
let requests = [];  
let feedbacks = []; 
let nextRequestId = 1;


// P0 ChangeRoom Session

// Scan an item into a session
app.post("/api/session/scan", (req, res) => {
  console.log("📱 SCAN ITEM - Session:", req.body.sessionId, "SKU:", req.body.sku);
  
  const { sessionId, sku, name, color, size, category, material, price } = req.body;

  if (!sessionId || !sku) {
    console.log("❌ SCAN FAILED - Missing sessionId or sku");
    return res.status(400).json({ error: "sessionId and sku are required" });
  }

  if (!sessions[sessionId]) {
    sessions[sessionId] = { items: [] };
    console.log("🆕 NEW SESSION CREATED:", sessionId);
  }

  // Store enhanced item data for better analytics
  const itemData = {
    sku,
    name: name || `Item ${sku}`,
    color: color || "Unknown",
    size: size || "Unknown",
    category: category || "General",
    material: material || "Unknown",
    price: price || "$0.00",
    scannedAt: new Date().toISOString()
  };

  sessions[sessionId].items.push(itemData);
  console.log("✅ ITEM SCANNED:", itemData.name, "- Total items in session:", sessions[sessionId].items.length);

  res.json({
    sessionId,
    items: sessions[sessionId].items,
  });
});


// Get session details
app.get("/api/session/:id", (req, res) => {
  const sessionId = req.params.id;
  const session = sessions[sessionId] || { items: [] };
  res.json(session);
});


//P0 ChangeRoom Requests

// Customer: submit a request for an item
app.post("/api/request", (req, res) => {
  console.log("🛒 NEW REQUEST - SKU:", req.body.sku, "Size:", req.body.requestedSize, "Color:", req.body.requestedColor);
  
  const { sessionId, sku, requestedSize, requestedColor } = req.body;

  if (!sessionId || !sku) {
    console.log("❌ REQUEST FAILED - Missing sessionId or sku");
    return res.status(400).json({ error: "sessionId and sku are required" });
  }

  const request = {
    id: nextRequestId++,
    sessionId,
    sku,
    requestedSize: requestedSize || null,
    requestedColor: requestedColor || null,
    status: "Queued",
  };

  requests.push(request);
  console.log("✅ REQUEST CREATED - ID:", request.id, "Status: Queued");
  res.json(request);
});

// Staff: view all open requests (for admin/staff dashboard)
app.get("/api/requests", (req, res) => {
  res.json(requests);
});


// Staff: Update request status
app.post("/api/request/:id/status", (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  
  console.log("🔄 STATUS UPDATE - Request ID:", id, "New Status:", status);

  const request = requests.find((r) => r.id === id);
  if (!request) {
    console.log("❌ REQUEST NOT FOUND - ID:", id);
    return res.status(404).json({ error: "Request not found" });
  }

  const oldStatus = request.status;
  request.status = status;
  console.log("✅ STATUS CHANGED - ID:", id, "From:", oldStatus, "To:", status);
  res.json(request);
});

// Get request status updates for a session (for kiosk notifications)
app.get("/api/requests/status/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  
  // Find requests for this session that have been updated recently
  const sessionRequests = requests.filter(r => r.sessionId === sessionId);
  
  // Return all requests with their current status
  // In a real system, you'd track which updates are "new" since last check
  const updates = sessionRequests.map(request => ({
    requestId: request.id,
    id: request.id,
    status: request.status,
    sku: request.sku
  }));
  
  res.json(updates);
});

// Get delivered items for a session (items that were requested and delivered)
app.get("/api/session/:sessionId/delivered", (req, res) => {
  const sessionId = req.params.sessionId;
  
  // Find all delivered requests for this session
  const deliveredRequests = requests.filter(r => 
    r.sessionId === sessionId && r.status === "Delivered"
  );
  
  // Convert requests back to item format for the kiosk
  const deliveredItems = deliveredRequests.map(request => ({
    sku: request.sku,
    name: `Delivered Item ${request.sku}`,
    color: request.requestedColor || "Default",
    size: request.requestedSize || "M",
    delivered: true,
    deliveredAt: new Date().toISOString()
  }));
  
  res.json({ items: deliveredItems });
});

//P0 ChangeRoom Feedback

app.post("/api/feedback", (req, res) => {
  const { sessionId, rating, comment } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  feedbacks.push({
    sessionId,
    rating: Number(rating) || 0,
    comment: comment || "",
  });

  res.json({ success: true });
});


// P1 Retail Analytics

app.get("/api/analytics", (req, res) => {
  console.log("📊 ANALYTICS REQUEST");
  
  const totalSessions = Object.keys(sessions).length;
  const totalRequests = requests.length;
  const avgRating =
    feedbacks.length > 0
      ? feedbacks.reduce((sum, f) => sum + (f.rating || 0), 0) /
        feedbacks.length
      : 0;

  // Calculate items tried (total items scanned across all sessions)
  const allItems = Object.values(sessions).flatMap(session => session.items || []);
  const itemsTried = allItems.length;

  console.log("📈 Analytics Summary - Sessions:", totalSessions, "Items Tried:", itemsTried, "Requests:", totalRequests);

  // Calculate most selected size
  const sizeCounts = {};
  allItems.forEach(item => {
    if (item.size) {
      sizeCounts[item.size] = (sizeCounts[item.size] || 0) + 1;
    }
  });
  const mostSelectedSize = Object.keys(sizeCounts).length > 0 
    ? Object.keys(sizeCounts).reduce((a, b) => sizeCounts[a] > sizeCounts[b] ? a : b)
    : "M";

  // Hardcoded values for now - will be dynamic in cloud
  const priceRange = "$39 - $89";
  const favouriteMaterial = "Cotton";

  // Calculate outfit categories
  const categories = {};
  allItems.forEach(item => {
    if (item.name) {
      if (/t-shirt|shorts|sneakers/i.test(item.name)) {
        categories["Streetwear"] = (categories["Streetwear"] || 0) + 1;
      } else if (/jacket|blazer|formal/i.test(item.name)) {
        categories["Old Money"] = (categories["Old Money"] || 0) + 1;
      } else {
        categories["Casual"] = (categories["Casual"] || 0) + 1;
      }
    }
  });
  const outfitCategories = Object.keys(categories).map(name => ({
    name,
    value: categories[name]
  }));

  // Extract colors from items
  const colors = [...new Set(allItems.map(item => item.color).filter(Boolean))];
  const defaultColors = ["#605A9A", "#A47F7F", "#2E7D32", "#FF6B6B", "#4ECDC4"];
  
  // Generate activity log
  const activity = [];
  allItems.slice(-5).forEach(item => {
    activity.push(`Scanned ${item.name || item.sku}`);
  });
  requests.slice(-3).forEach(request => {
    activity.push(`Requested ${request.requestedSize || request.requestedColor || 'item'} (${request.sku})`);
  });

  const analyticsData = {
    totalSessions,
    totalRequests,
    avgRating: Math.round(avgRating * 10) / 10,
    itemsTried,
    requestsMade: totalRequests,
    priceRange,
    favouriteMaterial,
    mostSelectedSize,
    colours: colors.length > 0 ? colors : defaultColors,
    outfitCategories: outfitCategories.length > 0 ? outfitCategories : [
      { name: "Streetwear", value: 3 },
      { name: "Casual", value: 2 }
    ],
    activity: activity.length > 0 ? activity : [
      "Session started",
      "Welcome to Vestia"
    ]
  };

  console.log("📊 ANALYTICS RESPONSE:", JSON.stringify(analyticsData, null, 2));
  res.json(analyticsData);
});


// ==================== MOCK POLYVORE-STYLE CATALOG ====================
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
  const total = WEIGHTS.color * colorScore + WEIGHTS.brand * brandScore + WEIGHTS.price * priceScore + WEIGHTS.style * styleScore;
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
    const candidates = catalog.filter(p => p.inStock && p.storeId === baseItem.storeId && p.category === category && p.category !== baseItem.category);
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
    scored.sort((a, b) => b.score - a.score);
    recommendations[category] = scored.slice(0, topK);
  }
  return recommendations;
}

// ==================== P1 RULE-BASED RECOMMENDATIONS ====================
app.post("/api/recommendations", (req, res) => {
  try {
    const { baseSku, storeId = "STORE-001", customerId, targetCategories = ["bottom", "shoes"], topK = 3 } = req.body;
    if (!baseSku) {
      return res.status(400).json({ error: "baseSku is required" });
    }
    const baseItem = mockCatalog.find(p => p.sku === baseSku && p.storeId === storeId);
    if (!baseItem) {
      return res.status(404).json({ error: "Base item not found in catalog" });
    }
    const customerProfile = customerId ? customerProfiles[customerId] : null;
    const recommendations = getRecommendations(baseItem, mockCatalog, customerProfile, targetCategories, topK);
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

app.get("/api/catalog/:sku", (req, res) => {
  const { sku } = req.params;
  const item = mockCatalog.find(p => p.sku === sku);
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }
  res.json(item);
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});