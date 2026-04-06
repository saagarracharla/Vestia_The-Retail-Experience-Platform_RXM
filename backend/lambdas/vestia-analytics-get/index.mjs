import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function assignProductZone(product) {
  if (!product) return "Z0";

  const category = product.masterCategory || product.category || "";
  const subCategory = product.subCategory || "";
  const articleType = product.articleType || "";
  const gender = product.gender || "";

  if (gender === "Men" && (category === "Apparel" || subCategory === "Topwear" || articleType.match(/shirt|tshirt|top|polo|sweater/i))) {
    return "Z2_T";
  }
  if (gender === "Men" && (subCategory === "Bottomwear" || articleType.match(/jeans|pants|shorts|track/i))) {
    return "Z2_B";
  }

  if (gender === "Women" && (category === "Apparel" || subCategory === "Topwear" || articleType.match(/shirt|tshirt|top|bra|tunic/i))) {
    return "Z3_T";
  }
  if (gender === "Women" && (subCategory === "Bottomwear" || articleType.match(/jeans|pants|shorts|skirt/i))) {
    return "Z3_B";
  }

  if ((gender === "Boys" || gender === "Girls") && category === "Apparel") {
    return "Z4";
  }

  if (category === "Footwear" || articleType.match(/shoes|flips|slippers|flip flops/i)) {
    return "Z5";
  }

  if (category === "Accessories" || articleType.match(/watches|belts|bags|socks/i)) {
    return articleType.match(/watches|belts/i) ? "Z1" : "Z6";
  }

  return "Z0";
}

function safeInc(obj, key) {
  if (!key) return;
  obj[key] = (obj[key] || 0) + 1;
}

function topN(counts, keyName, limit = 5) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ [keyName]: key, count }));
}

function getDays(rawDays) {
  const parsed = Number.parseInt(rawDays || "30", 10);
  if (Number.isNaN(parsed) || parsed <= 0) return 30;
  return Math.min(parsed, 365);
}

function isValidTimestamp(value) {
  return Boolean(value) && !Number.isNaN(Date.parse(value));
}

function isValidSessionEvent(item) {
  return (
    item &&
    item.PK?.startsWith("SESSION#") &&
    (item.entityType === "SCAN" || item.entityType === "REQUEST") &&
    typeof item.sessionId === "string" &&
    item.sessionId.length > 0 &&
    isValidTimestamp(item.createdAt)
  );
}

function isValidScanEvent(item) {
  return isValidSessionEvent(item) && item.entityType === "SCAN" && typeof item.sku === "string" && item.sku.length > 0;
}

function isValidRequestEvent(item) {
  return isValidSessionEvent(item) && item.entityType === "REQUEST" && typeof item.sku === "string" && item.sku.length > 0;
}

async function loadAnalyticsEvents(cutoff) {
  let items = [];
  let ExclusiveStartKey;

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: "VestiaSessions",
      FilterExpression: "begins_with(PK, :sessionPk) AND entityType IN (:scanType, :requestType) AND attribute_exists(#createdAt) AND #createdAt >= :cutoff",
      ExpressionAttributeNames: {
        "#createdAt": "createdAt",
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":sessionPk": "SESSION#",
        ":scanType": "SCAN",
        ":requestType": "REQUEST",
        ":cutoff": cutoff,
      },
      ProjectionExpression: "PK, SK, entityType, sessionId, sku, requestedSize, requestedColor, #status, createdAt, updatedAt, claimedAt, deliveredAt",
      ExclusiveStartKey,
    }));

    items = items.concat(result.Items || []);
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items.filter(isValidSessionEvent);
}

async function loadProductsBySku(scans) {
  const uniqueSkus = Array.from(new Set(scans.map(scan => scan.sku)));
  const products = {};

  for (let i = 0; i < uniqueSkus.length; i += 100) {
    const batch = uniqueSkus.slice(i, i + 100);
    const keys = batch.map(productId => ({ productId }));

    try {
      const result = await docClient.send(new BatchGetCommand({
        RequestItems: {
          ProductCatalog: { Keys: keys },
        },
      }));

      for (const product of result.Responses?.ProductCatalog || []) {
        products[product.productId] = product;
      }
    } catch (error) {
      console.warn("Batch product lookup failed:", error);
    }
  }

  return products;
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    const days = getDays(event.queryStringParameters?.days);
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

    const events = await loadAnalyticsEvents(cutoff);
    const scans = events.filter(isValidScanEvent);
    const requests = events.filter(isValidRequestEvent);
    const products = await loadProductsBySku(scans);

    const enrichedScans = scans.map(scan => {
      const product = products[scan.sku];
      return {
        sku: scan.sku,
        zoneId: assignProductZone(product),
        sessionId: scan.sessionId,
        createdAt: scan.createdAt,
        productName: product?.name || `SKU ${scan.sku}`,
      };
    });

    const sessionMap = new Map();
    const skuCounts = {};
    const sizeCounts = {};
    const colorCounts = {};
    const statusCounts = {};

    let fulfillmentSumMs = 0;
    let fulfillmentCount = 0;
    let requestToPickupSumMs = 0;
    let requestToPickupCount = 0;
    let pickupToDeliverySumMs = 0;
    let pickupToDeliveryCount = 0;

    for (const item of events) {
      const sessionId = item.sessionId;
      const createdMs = Date.parse(item.createdAt);

      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, { min: createdMs, max: createdMs });
      } else {
        const session = sessionMap.get(sessionId);
        session.min = Math.min(session.min, createdMs);
        session.max = Math.max(session.max, createdMs);
      }
    }

    for (const scan of scans) {
      safeInc(skuCounts, scan.sku);
    }

    for (const request of requests) {
      safeInc(sizeCounts, request.requestedSize);
      safeInc(colorCounts, request.requestedColor);
      safeInc(statusCounts, request.status);

      const createdMs = Date.parse(request.createdAt);
      const updatedMs = isValidTimestamp(request.updatedAt) ? Date.parse(request.updatedAt) : NaN;
      const claimedMs = isValidTimestamp(request.claimedAt) ? Date.parse(request.claimedAt) : NaN;
      const deliveredMs = isValidTimestamp(request.deliveredAt) ? Date.parse(request.deliveredAt) : NaN;

      if (!Number.isNaN(createdMs) && !Number.isNaN(claimedMs)) {
        requestToPickupSumMs += Math.max(0, claimedMs - createdMs);
        requestToPickupCount += 1;
      }

      if (!Number.isNaN(claimedMs) && !Number.isNaN(deliveredMs)) {
        pickupToDeliverySumMs += Math.max(0, deliveredMs - claimedMs);
        pickupToDeliveryCount += 1;
      }

      if (!Number.isNaN(createdMs) && !Number.isNaN(deliveredMs)) {
        fulfillmentSumMs += Math.max(0, deliveredMs - createdMs);
        fulfillmentCount += 1;
      } else if (request.status === "DELIVERED" && !Number.isNaN(createdMs) && !Number.isNaN(updatedMs)) {
        fulfillmentSumMs += Math.max(0, updatedMs - createdMs);
        fulfillmentCount += 1;
      }
    }

    let durationSumMs = 0;
    let durationCount = 0;
    for (const session of sessionMap.values()) {
      if (session.max >= session.min) {
        durationSumMs += session.max - session.min;
        durationCount += 1;
      }
    }

    const totalSessions = sessionMap.size;
    const totalScans = scans.length;
    const totalRequests = requests.length;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        period: { days, from: cutoff, to: now.toISOString() },
        totalSessions,
        totalScans,
        totalRequests,
        avgItemsPerSession: totalSessions > 0 ? Math.round((totalScans / totalSessions) * 10) / 10 : 0,
        avgSessionDurationSeconds: durationCount > 0 ? Math.round(durationSumMs / durationCount / 1000) : 0,
        avgFulfillmentSeconds: fulfillmentCount > 0 ? Math.round(fulfillmentSumMs / fulfillmentCount / 1000) : 0,
        avgRequestToPickupSeconds: requestToPickupCount > 0 ? Math.round(requestToPickupSumMs / requestToPickupCount / 1000) : 0,
        avgPickupToDeliverySeconds: pickupToDeliveryCount > 0 ? Math.round(pickupToDeliverySumMs / pickupToDeliveryCount / 1000) : 0,
        requestToPickupCount,
        pickupToDeliveryCount,
        requestFulfillmentRate: totalRequests > 0 ? Math.round(((statusCounts.DELIVERED || 0) / totalRequests) * 100) : 0,
        requestStatusBreakdown: statusCounts,
        topItems: topN(skuCounts, "sku"),
        topSizes: topN(sizeCounts, "size"),
        topColors: topN(colorCounts, "color"),
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
