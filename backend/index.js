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


// P1 Rule Based Outfit Reccommendations



const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});