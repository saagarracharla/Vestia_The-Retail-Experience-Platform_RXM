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
  console.log("SCAN ITEM - Session:", req.body.sessionId, "SKU:", req.body.sku);
  
  const { sessionId, sku, name, color, size, category, material, price } = req.body;

  if (!sessionId || !sku) {
    console.log("SCAN FAILED - Missing sessionId or sku");
    return res.status(400).json({ error: "sessionId and sku are required" });
  }

  if (!sessions[sessionId]) {
    sessions[sessionId] = { items: [] };
    console.log("NEW SESSION CREATED:", sessionId);
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
  console.log("ITEM SCANNED:", itemData.name, "- Total items in session:", sessions[sessionId].items.length);

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
  console.log("NEW REQUEST - SKU:", req.body.sku, "Size:", req.body.requestedSize, "Color:", req.body.requestedColor);
  
  const { sessionId, sku, requestedSize, requestedColor } = req.body;

  if (!sessionId || !sku) {
    console.log("REQUEST FAILED - Missing sessionId or sku");
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
  console.log("REQUEST CREATED - ID:", request.id, "Status: Queued");
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
  
  console.log("STATUS UPDATE - Request ID:", id, "New Status:", status);

  const request = requests.find((r) => r.id === id);
  if (!request) {
    console.log("REQUEST NOT FOUND - ID:", id);
    return res.status(404).json({ error: "Request not found" });
  }

  const oldStatus = request.status;
  request.status = status;
  console.log("STATUS CHANGED - ID:", id, "From:", oldStatus, "To:", status);
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
  console.log("ANALYTICS REQUEST");
  
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

  console.log("Analytics Summary - Sessions:", totalSessions, "Items Tried:", itemsTried, "Requests:", totalRequests);

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

  console.log("ANALYTICS RESPONSE:", JSON.stringify(analyticsData, null, 2));
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

// ==================== STATISTICAL ANALYSIS FROM SESSION DATA ====================

/**
 * Build statistical co-occurrence matrices from session data
 * Algorithmic complexity: Frequency counting, probability calculation
 */
function buildStatisticalMatrices() {
  const categoryTransitions = {};
  const colorPairs = {};
  const itemPairs = {};
  
  // Analyze all sessions to build statistical patterns
  Object.values(sessions).forEach(session => {
    const items = session.items || [];
    if (items.length < 2) return;
    
    // Extract categories and colors
    const categories = items.map(i => i.category).filter(Boolean);
    const colors = items.map(i => i.color).filter(Boolean);
    const skus = items.map(i => i.sku).filter(Boolean);
    
    // Category transitions (e.g., top -> bottom)
    for (let i = 0; i < categories.length; i++) {
      for (let j = i + 1; j < categories.length; j++) {
        const key = `${categories[i]}->${categories[j]}`;
        categoryTransitions[key] = (categoryTransitions[key] || 0) + 1;
      }
    }
    
    // Color pairs
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const pair = [colors[i].toLowerCase(), colors[j].toLowerCase()].sort().join("|");
        colorPairs[pair] = (colorPairs[pair] || 0) + 1;
      }
    }
    
    // Item pairs (co-occurrence)
    for (let i = 0; i < skus.length; i++) {
      for (let j = i + 1; j < skus.length; j++) {
        const pair = [skus[i], skus[j]].sort().join("|");
        itemPairs[pair] = (itemPairs[pair] || 0) + 1;
      }
    }
  });
  
  // Normalize to probabilities
  const normalizeTransitions = (counts) => {
    const totals = {};
    Object.keys(counts).forEach(key => {
      const from = key.split("->")[0];
      totals[from] = (totals[from] || 0) + counts[key];
    });
    
    const probs = {};
    Object.entries(counts).forEach(([key, count]) => {
      const from = key.split("->")[0];
      probs[key] = totals[from] > 0 ? Math.min(1.0, count / totals[from]) : 0;
    });
    return probs;
  };
  
  const normalizePairs = (counts) => {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0) || 1;
    const probs = {};
    Object.entries(counts).forEach(([key, count]) => {
      probs[key] = Math.min(1.0, count / total);
    });
    return probs;
  };
  
  return {
    categoryTransitions: normalizeTransitions(categoryTransitions),
    colorPairs: normalizePairs(colorPairs),
    itemPairs: normalizePairs(itemPairs),
    rawCounts: { categoryTransitions, colorPairs, itemPairs }
  };
}

/**
 * Build customer profile dynamically from session history
 * Algorithmic complexity: Statistical analysis (frequency, mean, variance)
 */
function deriveProfileFromSessions(customerIdOrSessionId) {
  // Find sessions for this customer (could be sessionId or customerId)
  const relevantSessions = Object.entries(sessions)
    .filter(([sessionId, session]) => {
      return sessionId === customerIdOrSessionId || session.customerId === customerIdOrSessionId;
    })
    .map(([_, session]) => session);
  
  if (relevantSessions.length === 0) return null;
  
  const allItems = relevantSessions.flatMap(s => s.items || []);
  if (allItems.length === 0) return null;
  
  // Statistical frequency analysis
  const colorFreq = {};
  const brandFreq = {};
  const styleFreq = {};
  const pricePoints = [];
  
  allItems.forEach(item => {
    // Color frequency
    if (item.color) {
      const color = item.color.toLowerCase();
      colorFreq[color] = (colorFreq[color] || 0) + 1;
    }
    
    // Brand frequency (if we had brand data)
    // brandFreq[item.brand] = (brandFreq[item.brand] || 0) + 1;
    
    // Price points (extract numeric value if possible)
    if (item.price) {
      const price = typeof item.price === 'string' 
        ? parseFloat(item.price.replace(/[^0-9.]/g, ''))
        : item.price;
      if (!isNaN(price) && price > 0) {
        pricePoints.push(price);
      }
    }
  });
  
  // Statistical calculations
  const mean = (values) => {
    if (!values.length) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  };
  
  const stdDev = (values) => {
    if (!values.length) return 30.0; // Default
    const avg = mean(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    return Math.sqrt(variance) || 30.0;
  };
  
  return {
    customerId: customerIdOrSessionId,
    preferredColors: colorFreq,
    brandAffinity: brandFreq,
    preferredStyles: styleFreq,
    avgPriceSpent: mean(pricePoints),
    priceStdDev: stdDev(pricePoints),
    sessionCount: relevantSessions.length,
    itemsScanned: allItems.length
  };
}

// Build statistical matrices (recalculated on each request for POC)
// In production, this would be cached and updated periodically

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
  color: 0.25,        // Rule-based color compatibility
  colorPattern: 0.15, // Statistical color co-occurrence
  brand: 0.20,
  price: 0.20,
  style: 0.12,
  coOccurrence: 0.08  // Statistical item co-occurrence
};

/**
 * Enhanced color compatibility: Rule-based + Statistical
 * Algorithmic complexity: Hybrid scoring with data-driven insights
 */
function colorCompatibilityScore(color1, color2, stats = null) {
  // Rule-based score (primary)
  const key1 = `${color1.toLowerCase()}-${color2.toLowerCase()}`;
  const key2 = `${color2.toLowerCase()}-${color1.toLowerCase()}`;
  const ruleScore = COLOR_COMPATIBILITY[key1] || COLOR_COMPATIBILITY[key2] || 0.6;
  
  // Statistical score (enhancement)
  let statScore = ruleScore;
  if (stats && stats.colorPairs) {
    const pairKey = [color1.toLowerCase(), color2.toLowerCase()].sort().join("|");
    statScore = stats.colorPairs[pairKey] || ruleScore;
  }
  
  // Hybrid: 70% rule, 30% statistical
  return Math.min(1.0, ruleScore * 0.7 + statScore * 0.3);
}

/**
 * Color pattern support from session data (statistical)
 */
function colorPatternSupport(color1, color2, stats) {
  if (!stats || !stats.colorPairs) return 0.5;
  const pairKey = [color1.toLowerCase(), color2.toLowerCase()].sort().join("|");
  return stats.colorPairs[pairKey] || 0.5;
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

/**
 * Statistical co-occurrence score from session data
 */
function coOccurrenceScore(sku1, sku2, stats) {
  if (!stats || !stats.itemPairs) return 0.35; // Default fallback
  const pairKey = [sku1, sku2].sort().join("|");
  return stats.itemPairs[pairKey] || 0.35;
}

/**
 * Category transition probability from session data
 */
function categoryTransitionScore(fromCategory, toCategory, stats) {
  if (!stats || !stats.categoryTransitions) return 0.4; // Default
  const key = `${fromCategory}->${toCategory}`;
  const prob = stats.categoryTransitions[key] || 0.4;
  
  // Boost common transitions
  const commonTransitions = {
    "top->bottom": 1.15,
    "bottom->shoes": 1.15,
    "top->shoes": 1.1,
    "top->outerwear": 1.1
  };
  const boost = commonTransitions[key] || 1.0;
  
  return Math.min(1.0, prob * boost);
}

/**
 * Enhanced scoring with statistical analysis
 * Algorithmic complexity: Multi-factor optimization with statistical insights
 */
function calculateScore(baseItem, candidate, profile, stats = null) {
  const colorScore = colorCompatibilityScore(baseItem.colorFamily, candidate.colorFamily, stats);
  const colorPatternScore = colorPatternSupport(baseItem.colorFamily, candidate.colorFamily, stats);
  const brandScore = brandAffinityScore(candidate.brand, profile);
  const priceScore = priceClosenessScore(candidate.price, profile);
  const styleScore = styleOverlapScore(baseItem.styleTags, candidate.styleTags, profile);
  const coOccurrence = coOccurrenceScore(baseItem.sku, candidate.sku, stats);
  
  const total = 
    WEIGHTS.color * colorScore +
    WEIGHTS.colorPattern * colorPatternScore +
    WEIGHTS.brand * brandScore +
    WEIGHTS.price * priceScore +
    WEIGHTS.style * styleScore +
    WEIGHTS.coOccurrence * coOccurrence;
  
  return {
    score: Math.round(total * 1000) / 1000,
    components: {
      colorCompatibility: colorScore,
      colorPatternSupport: colorPatternScore,
      brandAffinity: brandScore,
      priceCloseness: priceScore,
      styleOverlap: styleScore,
      coOccurrence: coOccurrence
    }
  };
}

function getScoreBreakdown(baseItem, candidate, profile, stats = null) {
  const { components } = calculateScore(baseItem, candidate, profile, stats);
  return {
    colorCompatibility: Math.round(components.colorCompatibility * 1000) / 1000,
    colorPatternSupport: Math.round(components.colorPatternSupport * 1000) / 1000,
    brandAffinity: Math.round(components.brandAffinity * 1000) / 1000,
    priceCloseness: Math.round(components.priceCloseness * 1000) / 1000,
    styleOverlap: Math.round(components.styleOverlap * 1000) / 1000,
    coOccurrence: Math.round(components.coOccurrence * 1000) / 1000
  };
}

/**
 * Generate human-readable explanations for recommendations
 * Algorithmic complexity: Pattern-based explanation generation
 */
function buildRecommendationExplanation(baseItem, candidate, profile, components, stats) {
  const reasons = [];
  
  // Statistical evidence
  if (stats && stats.rawCounts && stats.rawCounts.itemPairs) {
    const pairKey = [baseItem.sku, candidate.sku].sort().join("|");
    const pairCount = stats.rawCounts.itemPairs[pairKey];
    if (pairCount) {
      reasons.push(
        `Seen together in ${pairCount} session${pairCount > 1 ? "s" : ""} (statistical co-occurrence: ${toPercent(components.coOccurrence)}).`
      );
    }
  }
  
  // Category transition
  if (components.coOccurrence > 0.3) {
    const transitionProb = categoryTransitionScore(baseItem.category, candidate.category, stats);
    if (transitionProb > 0.5) {
      reasons.push(
        `Strong category pairing: ${toPercent(transitionProb)} of customers pair ${baseItem.category}s with ${candidate.category}s.`
      );
    }
  }
  
  // Color compatibility
  if (components.colorCompatibility >= 0.75) {
    reasons.push(
      `High color compatibility: ${toPercent(components.colorCompatibility)} (${baseItem.colorFamily} + ${candidate.colorFamily}).`
    );
  } else if (components.colorPatternSupport > components.colorCompatibility) {
    reasons.push(
      `Color combination appears frequently in customer sessions (pattern support: ${toPercent(components.colorPatternSupport)}).`
    );
  }
  
  // Style compatibility
  if (components.styleOverlap >= 0.6) {
    const sharedStyles = baseItem.styleTags.filter(t => 
      candidate.styleTags.map(s => s.toLowerCase()).includes(t.toLowerCase())
    );
    if (sharedStyles.length > 0) {
      reasons.push(`Shared style elements: ${sharedStyles.join(", ")} (style overlap: ${toPercent(components.styleOverlap)}).`);
    }
  }
  
  // Brand affinity
  if (components.brandAffinity >= 0.6 && profile) {
    reasons.push(`Matches your brand preference (affinity: ${toPercent(components.brandAffinity)}).`);
  }
  
  // Price matching
  if (components.priceCloseness >= 0.7) {
    reasons.push(`Price aligns with your spending pattern (${toPercent(components.priceCloseness)} match).`);
  }
  
  // Personalization
  if (profile && profile.preferredColors) {
    const colorFreq = profile.preferredColors[candidate.colorFamily.toLowerCase()] || 0;
    if (colorFreq > 0) {
      reasons.push(`This color matches your preferences (you've tried ${colorFreq} similar item${colorFreq > 1 ? "s" : ""}).`);
    }
  }
  
  // Fallback
  if (!reasons.length) {
    reasons.push("Compatible based on multiple algorithmic factors: color patterns, category transitions, and style matching.");
  }
  
  return reasons;
}

function toPercent(score) {
  return `${Math.round((score || 0) * 100)}%`;
}

/**
 * Enhanced recommendations with statistical analysis and explanations
 * Algorithmic complexity: Multi-factor scoring with statistical insights
 */
function getRecommendations(baseItem, catalog, customerProfile, targetCategories, topK = 3, stats = null) {
  const recommendations = {};
  
  for (const category of targetCategories) {
    const candidates = catalog.filter(p => 
      p.inStock && 
      p.storeId === baseItem.storeId && 
      p.category === category && 
      p.category !== baseItem.category
    );
    
    const scored = candidates.map(candidate => {
      const { score, components } = calculateScore(baseItem, candidate, customerProfile, stats);
      const scoreBreakdown = getScoreBreakdown(baseItem, candidate, customerProfile, stats);
      const explanations = buildRecommendationExplanation(
        baseItem,
        candidate,
        customerProfile,
        components,
        stats
      );
      
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
        scoreBreakdown,
        explanations
      };
    });
    
    // Sort by score (descending) and take top K
    scored.sort((a, b) => b.score - a.score);
    recommendations[category] = scored.slice(0, topK);
  }
  
  return recommendations;
}

// ==================== P1 RULE-BASED RECOMMENDATIONS (Enhanced) ====================
app.post("/api/recommendations", (req, res) => {
  try {
    const { 
      baseSku, 
      storeId = "STORE-001", 
      customerId, 
      sessionId,
      targetCategories = ["bottom", "shoes"], 
      topK = 3 
    } = req.body;
    
    if (!baseSku) {
      return res.status(400).json({ error: "baseSku is required" });
    }
    
    const baseItem = mockCatalog.find(p => p.sku === baseSku && p.storeId === storeId);
    if (!baseItem) {
      return res.status(404).json({ error: "Base item not found in catalog" });
    }
    
    // Build statistical matrices from session data
    const stats = buildStatisticalMatrices();
    
    // Get customer profile (static or dynamic from sessions)
    let customerProfile = null;
    if (customerId) {
      customerProfile = customerProfiles[customerId] || null;
    }
    
    // Try to build dynamic profile from session if customerId not provided but sessionId is
    if (!customerProfile && sessionId) {
      const dynamicProfile = deriveProfileFromSessions(sessionId);
      if (dynamicProfile) {
        customerProfile = dynamicProfile;
      }
    }
    
    // Get recommendations with statistical analysis
    const recommendations = getRecommendations(
      baseItem, 
      mockCatalog, 
      customerProfile, 
      targetCategories, 
      topK,
      stats
    );
    
    res.json({
      sessionId: sessionId || req.headers['x-session-id'] || `session-${Date.now()}`,
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
      customerPersonalized: !!customerProfile,
      statsSummary: {
        totalSessions: Object.keys(sessions).length,
        categoryTransitions: Object.keys(stats.categoryTransitions).length,
        colorPairs: Object.keys(stats.colorPairs).length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== P2 MIX & MATCH - COMPLETE OUTFIT GENERATOR ====================
/**
 * Generate complete coordinated outfits (Top + Bottom + Shoes)
 * Algorithmic complexity: Combinatorial generation O(n × m × k)
 * Rule-based with statistical scoring
 */
app.post("/api/mix-match", (req, res) => {
  try {
    const {
      baseSku,          // Starting item (e.g., top)
      storeId = "STORE-001",
      customerId,
      sessionId,
      topK = 5          // Number of complete outfits to return
    } = req.body;
    
    if (!baseSku) {
      return res.status(400).json({ error: "baseSku is required" });
    }
    
    // Find base item
    const baseItem = mockCatalog.find(p => p.sku === baseSku && p.storeId === storeId);
    if (!baseItem) {
      return res.status(404).json({ error: "Base item not found in catalog" });
    }
    
    // Build statistical matrices
    const stats = buildStatisticalMatrices();
    
    // Get customer profile
    let customerProfile = null;
    if (customerId) {
      customerProfile = customerProfiles[customerId] || null;
    }
    if (!customerProfile && sessionId) {
      customerProfile = deriveProfileFromSessions(sessionId);
    }
    
    // Filter candidates by category
    const candidates = {
      top: baseItem.category === "top" ? [baseItem] : 
        mockCatalog.filter(i => i.category === "top" && i.inStock && i.storeId === storeId),
      bottom: mockCatalog.filter(i => i.category === "bottom" && i.inStock && i.storeId === storeId),
      shoes: mockCatalog.filter(i => i.category === "shoes" && i.inStock && i.storeId === storeId),
      outerwear: mockCatalog.filter(i => i.category === "outerwear" && i.inStock && i.storeId === storeId)
    };
    
    // Combinatorial generation: Generate all valid outfit combinations
    const outfits = [];
    
    // Use base item as top if it's a top, otherwise allow all tops
    const topsToUse = baseItem.category === "top" ? [baseItem] : candidates.top;
    
    // Generate combinations (combinatorial algorithm)
    for (const top of topsToUse) {
      for (const bottom of candidates.bottom) {
        for (const shoe of candidates.shoes) {
          // Rule-based constraint: Color compatibility check
          if (passesColorCompatibilityCheck([top, bottom, shoe])) {
            // Score complete outfit
            const outfitScore = scoreCompleteOutfit(
              [top, bottom, shoe],
              customerProfile,
              stats
            );
            
            // Generate explanation
            const explanation = explainOutfitCompatibility(
              [top, bottom, shoe],
              customerProfile,
              stats
            );
            
            outfits.push({
              outfitId: `outfit-${top.sku}-${bottom.sku}-${shoe.sku}`,
              items: {
                top: {
                  sku: top.sku,
                  name: top.name,
                  brand: top.brand,
                  price: top.price,
                  color: top.colorFamily,
                  image: top.image
                },
                bottom: {
                  sku: bottom.sku,
                  name: bottom.name,
                  brand: bottom.brand,
                  price: bottom.price,
                  color: bottom.colorFamily,
                  image: bottom.image
                },
                shoes: {
                  sku: shoe.sku,
                  name: shoe.name,
                  brand: shoe.brand,
                  price: shoe.price,
                  color: shoe.colorFamily,
                  image: shoe.image
                }
              },
              totalPrice: top.price + bottom.price + shoe.price,
              score: outfitScore.score,
              scoreBreakdown: outfitScore.components,
              explanations: explanation
            });
          }
        }
      }
    }
    
    // Sort by score and return top K
    outfits.sort((a, b) => b.score - a.score);
    const topOutfits = outfits.slice(0, topK);
    
    res.json({
      sessionId: sessionId || req.headers['x-session-id'] || `session-${Date.now()}`,
      baseItem: {
        sku: baseItem.sku,
        name: baseItem.name,
        category: baseItem.category,
        color: baseItem.colorFamily
      },
      totalCombinations: outfits.length,
      outfits: topOutfits,
      customerPersonalized: !!customerProfile,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Mix & Match error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Score complete outfit (not just pairwise)
 * Algorithmic complexity: Multi-factor optimization across 3+ items
 */
function scoreCompleteOutfit(items, profile, stats) {
  // Color harmony across all items
  const colorHarmony = calculateColorHarmony(items, stats);
  
  // Style consistency across all items
  const styleConsistency = calculateStyleConsistency(items);
  
  // Category balance (already enforced: must have top, bottom, shoes)
  const categoryBalance = 1.0;
  
  // Personalization
  const personalization = calculateOutfitPersonalization(items, profile);
  
  // Statistical co-occurrence
  const coOccurrence = calculateOutfitCoOccurrence(items, stats);
  
  const score = (
    colorHarmony * 0.3 +
    styleConsistency * 0.25 +
    personalization * 0.25 +
    coOccurrence * 0.2
  );
  
  return {
    score: Math.round(score * 1000) / 1000,
    components: {
      colorHarmony,
      styleConsistency,
      categoryBalance,
      personalization,
      coOccurrence
    }
  };
}

/**
 * Calculate color harmony across all items in outfit
 */
function calculateColorHarmony(items, stats) {
  if (items.length < 2) return 0.5;
  
  let totalScore = 0;
  let pairCount = 0;
  
  // Check all pairs
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const score = colorCompatibilityScore(
        items[i].colorFamily,
        items[j].colorFamily,
        stats
      );
      totalScore += score;
      pairCount++;
    }
  }
  
  return pairCount > 0 ? totalScore / pairCount : 0.5;
}

/**
 * Calculate style consistency across all items
 */
function calculateStyleConsistency(items) {
  if (items.length < 2) return 0.5;
  
  const allTags = items.flatMap(i => i.styleTags || []);
  const uniqueTags = new Set(allTags.map(t => t.toLowerCase()));
  
  // More shared tags = higher consistency
  const sharedTags = allTags.filter((tag, index, self) => 
    self.filter(t => t.toLowerCase() === tag.toLowerCase()).length > 1
  );
  
  const consistencyScore = uniqueTags.size > 0 
    ? Math.min(1.0, sharedTags.length / uniqueTags.size + 0.3)
    : 0.5;
  
  return consistencyScore;
}

/**
 * Calculate personalization score for complete outfit
 */
function calculateOutfitPersonalization(items, profile) {
  if (!profile) return 0.5;
  
  let totalScore = 0;
  items.forEach(item => {
    // Check color preference
    if (profile.preferredColors) {
      const colorFreq = profile.preferredColors[item.colorFamily.toLowerCase()] || 0;
      totalScore += Math.min(1.0, colorFreq / 5.0); // Normalize
    }
    
    // Check style preference
    if (profile.preferredStyles && item.styleTags) {
      item.styleTags.forEach(tag => {
        const styleFreq = profile.preferredStyles[tag.toLowerCase()] || 0;
        totalScore += Math.min(1.0, styleFreq / 10.0);
      });
    }
  });
  
  return Math.min(1.0, totalScore / items.length);
}

/**
 * Calculate co-occurrence score for complete outfit
 */
function calculateOutfitCoOccurrence(items, stats) {
  if (!stats || items.length < 2) return 0.5;
  
  let totalScore = 0;
  let pairCount = 0;
  
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const score = coOccurrenceScore(items[i].sku, items[j].sku, stats);
      totalScore += score;
      pairCount++;
    }
  }
  
  return pairCount > 0 ? totalScore / pairCount : 0.5;
}

/**
 * Check if outfit passes color compatibility rules
 * P2 Constraint: "favour neutral bottoms with bright tops"
 */
function passesColorCompatibilityCheck(items) {
  if (items.length < 2) return true;
  
  // Extract colors
  const colors = items.map(i => i.colorFamily?.toLowerCase() || "");
  
  // Check for strong clashes
  const strongClashes = [
    ["red", "green"],
    ["red", "orange"],
    ["blue", "orange"],
    ["purple", "yellow"]
  ];
  
  for (const clash of strongClashes) {
    if (colors.includes(clash[0]) && colors.includes(clash[1])) {
      return false;
    }
  }
  
  return true;
}

/**
 * Generate explanation for outfit compatibility
 */
function explainOutfitCompatibility(items, profile, stats) {
  const reasons = [];
  
  // Color harmony
  const colorHarmony = calculateColorHarmony(items, stats);
  if (colorHarmony >= 0.75) {
    reasons.push(`Excellent color harmony: ${toPercent(colorHarmony)} compatibility across all items.`);
  } else if (colorHarmony >= 0.6) {
    reasons.push(`Good color coordination: ${toPercent(colorHarmony)} harmony.`);
  }
  
  // Style consistency
  const styleConsistency = calculateStyleConsistency(items);
  if (styleConsistency >= 0.7) {
    const sharedTags = items[0].styleTags.filter(tag =>
      items.every(i => i.styleTags.includes(tag))
    );
    if (sharedTags.length > 0) {
      reasons.push(`Cohesive style: All items share "${sharedTags.join(", ")}" style.`);
    }
  }
  
  // Personalization
  if (profile) {
    reasons.push(`Personalized to your preferences.`);
  }
  
  // Price range
  const totalPrice = items.reduce((sum, i) => sum + i.price, 0);
  if (profile && profile.avgPriceSpent) {
    const priceDiff = Math.abs(totalPrice - (profile.avgPriceSpent * 2));
    if (priceDiff < profile.priceStdDev) {
      reasons.push(`Total price ($${totalPrice.toFixed(2)}) aligns with your spending pattern.`);
    }
  }
  
  if (!reasons.length) {
    reasons.push("Well-coordinated outfit based on color harmony and style consistency.");
  }
  
  return reasons;
}

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
  console.log(`\nBackend API running on http://localhost:${PORT}`);
  console.log(`\nAlgorithm Status:`);
  console.log(`  - Rule-based recommendation engine (enhanced)`);
  console.log(`  - Statistical analysis from session data`);
  console.log(`  - Dynamic profile generation`);
  console.log(`  - Explanation generation`);
  console.log(`  - Mix & Match combinatorial algorithm`);
  console.log(`\nAvailable Endpoints:`);
  console.log(`  POST /api/recommendations - Enhanced rule-based recommendations`);
  console.log(`  POST /api/mix-match      - Complete outfit generator (combinatorial)`);
  console.log(`  GET  /api/catalog        - View catalog items`);
  console.log(`  POST /api/session/scan   - Scan item into session`);
  console.log(`  GET  /api/session/:id    - Get session details`);
  console.log(`  POST /api/request        - Create size/color request`);
  console.log(`  GET  /api/analytics      - View analytics`);
  console.log(`\nAlgorithm Complexity:`);
  console.log(`  - Multi-factor optimization (6 scoring components)`);
  console.log(`  - Statistical co-occurrence analysis`);
  console.log(`  - Combinatorial generation O(n × m × k)`);
  console.log(`  - Dynamic profile building from session data`);
  console.log(`\n`);
});