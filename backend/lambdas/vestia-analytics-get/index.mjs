import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);

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

    // Scan only SESSION# partitions to avoid double-counting requests
    // (requests are stored in both SESSION# and STORE# partitions)
    let items = [];
    let ExclusiveStartKey;

    do {
      const result = await docClient.send(new ScanCommand({
        TableName: "VestiaSessions",
        FilterExpression: "createdAt > :cutoff AND begins_with(PK, :prefix)",
        ExpressionAttributeValues: {
          ":cutoff": cutoff,
          ":prefix": "SESSION#",
        },
        ProjectionExpression: "entityType, sessionId, sku, requestedSize, requestedColor, #s, createdAt, updatedAt",
        ExpressionAttributeNames: { "#s": "status" },
        ExclusiveStartKey,
      }));
      items = items.concat(result.Items || []);
      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);

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

    for (const item of items) {
      const sessionId = item.sessionId || "";
      const createdMs = item.createdAt ? Date.parse(item.createdAt) : NaN;
      const updatedMs = item.updatedAt ? Date.parse(item.updatedAt) : NaN;

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
        requestFulfillmentRate: totalRequests > 0
          ? Math.round(((statusCounts["DELIVERED"] || 0) / totalRequests) * 100) : 0,
        requestStatusBreakdown: statusCounts,
        topItems,
        topSizes,
        topColors,
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
