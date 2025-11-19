const express = require("express");
const cors = require("cors");


const app = express();
app.use(cors());
app.use(express.json());


let sessions = {};   
let requests = [];  
let feedbacks = []; 
let nextRequestId = 1;


// P0 ChangeRoom Session

// Scan an item into a session
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


// Get session details
app.get("/api/session/:id", (req, res) => {
  const sessionId = req.params.id;
  const session = sessions[sessionId] || { items: [] };
  res.json(session);
});


//P0 ChangeRoom Requests

// Customer: submit a request for an item
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
  };

  requests.push(request);
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

  const request = requests.find((r) => r.id === id);
  if (!request) {
    return res.status(404).json({ error: "Request not found" });
  }

  request.status = status;
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
  const totalSessions = Object.keys(sessions).length;
  const totalRequests = requests.length;
  const avgRating =
    feedbacks.length > 0
      ? feedbacks.reduce((sum, f) => sum + (f.rating || 0), 0) /
        feedbacks.length
      : 0;

  res.json({
    totalSessions,
    totalRequests,
    avgRating,
  });
});


// P1 Rule Based Outfit Reccommendations



const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});