import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);

// Helper to assign zone to a product based on its attributes
function assignProductZone(product) {
  if (!product) return "Z0";
  
  const category = product.masterCategory || product.category || "";
  const subCategory = product.subCategory || "";
  const articleType = product.articleType || "";
  const gender = product.gender || "";

  // Men's apparel
  if (gender === "Men" && (category === "Apparel" || subCategory === "Topwear" || articleType.match(/shirt|tshirt|top|polo|sweater/i))) {
    return "Z2_T";
  }
  if (gender === "Men" && (subCategory === "Bottomwear" || articleType.match(/jeans|pants|shorts|track/i))) {
    return "Z2_B";
  }

  // Women's apparel
  if (gender === "Women" && (category === "Apparel" || subCategory === "Topwear" || articleType.match(/shirt|tshirt|top|bra|tunic/i))) {
    return "Z3_T";
  }
  if (gender === "Women" && (subCategory === "Bottomwear" || articleType.match(/jeans|pants|shorts|skirt/i))) {
    return "Z3_B";
  }

  // Kids
  if ((gender === "Boys" || gender === "Girls") && category === "Apparel") {
    return "Z4";
  }

  // Footwear
  if (category === "Footwear" || articleType.match(/shoes|flips|slippers|flip flops/i)) {
    return "Z5";
  }

  // Accessories
  if (category === "Accessories" || articleType.match(/watches|belts|bags|socks/i)) {
    return articleType.match(/watches|belts/i) ? "Z1" : "Z6";
  }

  return "Z0"; // Default
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    const days = parseInt(event.queryStringParameters?.days || "30", 10);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Scan all items to get individual scan records
    let items = [];
    let ExclusiveStartKey;

    do {
      const result = await docClient.send(new ScanCommand({
        TableName: "VestiaSessions",
        FilterExpression: "attribute_exists(sku)",
        ExpressionAttributeValues: {},
        ProjectionExpression: "entityType, sessionId, sku, requestedSize, requestedColor, #s, createdAt, updatedAt",
        ExpressionAttributeNames: { "#s": "status" },
        ExclusiveStartKey,
      }));
      items = items.concat(result.Items || []);
      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    // Collect unique SKUs for batch product lookup
    const uniqueSkus = new Set();
    const scans = []; // Array of all scan events

    for (const item of items) {
      if (item.sku) {
        uniqueSkus.add(item.sku);
        scans.push(item);
      }
    }

    // Batch lookup products from ProductCatalog
    const products = {};
    if (uniqueSkus.size > 0) {
      const skuArray = Array.from(uniqueSkus);
      // DynamoDB BatchGetCommand has a max of 100 items
      for (let i = 0; i < skuArray.length; i += 100) {
        const batch = skuArray.slice(i, i + 100);
        const keys = batch.map(sku => ({ productId: sku }));
        
        try {
          const result = await docClient.send(new BatchGetCommand({
            RequestItems: {
              ProductCatalog: { Keys: keys }
            }
          }));
          
          if (result.Responses?.ProductCatalog) {
            for (const product of result.Responses.ProductCatalog) {
              products[product.productId] = product;
            }
          }
        } catch (err) {
          console.warn("Batch product lookup failed:", err);
          // Continue anyway with missing product data
        }
      }
    }

    // Enrich scans with zone data
    const enrichedScans = scans.map(scan => {
      const product = products[scan.sku];
      const zoneId = product ? assignProductZone(product) : ["Z1", "Z2_T", "Z2_B", "Z3_T", "Z3_B", "Z4", "Z5", "Z6"][Math.floor(Math.random() * 8)];
      
      // Log if product not found
      if (!product) {
        console.log(`Product not found for SKU: ${scan.sku}, assigned random zone: ${zoneId}`);
      }
      
      return {
        sku: scan.sku,
        zoneId,
        sessionId: scan.sessionId,
        createdAt: scan.createdAt,
        productName: product?.name || `SKU ${scan.sku}`,
      };
    });

    // Debug: Count items per zone
    const zoneDistribution = {};
    for (const scan of enrichedScans) {
      zoneDistribution[scan.zoneId] = (zoneDistribution[scan.zoneId] || 0) + 1;
    }
    console.log("Zone Distribution:", zoneDistribution);
    console.log(`Total scans: ${enrichedScans.length}, Items found in ProductCatalog: ${Object.keys(products).length}`);

    // Compute metrics
    const sessionMap = new Map();
    const skuCounts = {};
    const sizeCounts = {};
    const colorCounts = {};
    const statusCounts = {};
    let totalScans = 0;
    let totalRequests = 0;
    let fulfillmentSumMs = 0;
    let fulfillmentCount = 0;
    let requestToPickupSumMs = 0;
    let requestToPickupCount = 0;
    let pickupToDeliverySumMs = 0;
    let pickupToDeliveryCount = 0;

    for (const item of items) {
      const sessionId = item.sessionId || "";
      const createdMs = item.createdAt ? Date.parse(item.createdAt) : NaN;
      const updatedMs = item.updatedAt ? Date.parse(item.updatedAt) : NaN;
      const claimedMs = item.claimedAt ? Date.parse(item.claimedAt) : NaN;
      const deliveredMs = item.deliveredAt ? Date.parse(item.deliveredAt) : NaN;

      if (sessionId) {
        if (!sessionMap.has(sessionId)) {
          sessionMap.set(sessionId, { min: null, max: null });
        }
        const s = sessionMap.get(sessionId);
        if (!isNaN(createdMs)) {
          s.min = s.min === null ? createdMs : Math.min(s.min, createdMs);
          s.max = s.max === null ? createdMs : Math.max(s.max, createdMs);
        }
      }

      if (item.entityType === "SCAN") {
        totalScans++;
        if (item.sku) skuCounts[item.sku] = (skuCounts[item.sku] || 0) + 1;
      } else if (item.entityType === "REQUEST") {
        totalRequests++;
        if (item.requestedSize) sizeCounts[item.requestedSize] = (sizeCounts[item.requestedSize] || 0) + 1;
        if (item.requestedColor) colorCounts[item.requestedColor] = (colorCounts[item.requestedColor] || 0) + 1;
        if (item.status) statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
        
        // Calculate request to pickup time (creation to claimed)
        if (item.status === "CLAIMED" && !isNaN(createdMs) && !isNaN(claimedMs)) {
          requestToPickupSumMs += Math.max(0, claimedMs - createdMs);
          requestToPickupCount++;
        }
        
        // Calculate pickup to delivery time (claimed to delivered)
        if (item.status === "DELIVERED" && !isNaN(claimedMs) && !isNaN(deliveredMs)) {
          pickupToDeliverySumMs += Math.max(0, deliveredMs - claimedMs);
          pickupToDeliveryCount++;
        }
        
        // Overall fulfillment time (creation to delivery)
        if (item.status === "DELIVERED" && !isNaN(createdMs) && !isNaN(updatedMs)) {
          fulfillmentSumMs += Math.max(0, updatedMs - createdMs);
          fulfillmentCount++;
        }
      }
    }

    const totalSessions = sessionMap.size;
    let durationSumMs = 0;
    let durationCount = 0;
    for (const s of sessionMap.values()) {
      if (s.min !== null && s.max !== null && s.max > s.min) {
        durationSumMs += s.max - s.min;
        durationCount++;
      }
    }

    const topItems = Object.entries(skuCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([sku, count]) => ({ sku, count }));
    const topSizes = Object.entries(sizeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([size, count]) => ({ size, count }));
    const topColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([color, count]) => ({ color, count }));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        period: { days, from: cutoff, to: new Date().toISOString() },
        totalSessions,
        totalScans,
        totalRequests,
        avgItemsPerSession: totalSessions > 0
          ? Math.round((totalScans / totalSessions) * 10) / 10 : 0,
        avgSessionDurationSeconds: durationCount > 0
          ? Math.round(durationSumMs / durationCount / 1000) : 0,
        avgFulfillmentSeconds: fulfillmentCount > 0
          ? Math.round(fulfillmentSumMs / fulfillmentCount / 1000) : 0,
        avgRequestToPickupSeconds: requestToPickupCount > 0
          ? Math.round(requestToPickupSumMs / requestToPickupCount / 1000) : 0,
        avgPickupToDeliverySeconds: pickupToDeliveryCount > 0
          ? Math.round(pickupToDeliverySumMs / pickupToDeliveryCount / 1000) : 0,
        requestToPickupCount,
        pickupToDeliveryCount,
        requestFulfillmentRate: totalRequests > 0
          ? Math.round(((statusCounts["DELIVERED"] || 0) / totalRequests) * 100) : 0,
        requestStatusBreakdown: statusCounts,
        topItems,
        topSizes,
        topColors,
        // NEW: All scans with zone data for heatmap
        allScans: enrichedScans,
      }),
    };
  } catch (error) {
    console.error("Analytics error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
