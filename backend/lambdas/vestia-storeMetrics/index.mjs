import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION || process.env.AWS_REGION || "ca-central-1";
const TABLE_NAME = process.env.TABLE_NAME;
const BUCKET_NAME = process.env.BUCKET_NAME;
const PREFIX = process.env.S3_PREFIX || "analytics/daily";
const STORE_ID = process.env.STORE_ID || null;

// Optional: force “yesterday” based on Toronto time boundaries if you set TZ=America/Toronto in Lambda
const TZ = process.env.TZ || "America/Toronto";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const s3 = new S3Client({ region: REGION });

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/"/g, "\"\"")}"`;
  }
  return str;
}

function topN(counts, n = 3) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function safeInc(obj, key) {
  if (!key) return;
  obj[key] = (obj[key] || 0) + 1;
}

export const handler = async (event = {}) => {
  if (!TABLE_NAME || !BUCKET_NAME) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Missing TABLE_NAME or BUCKET_NAME env vars"
      })
    };
  }

  // Compute “yesterday” in local runtime time (set TZ on Lambda for Toronto)
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);

  const startISO = start.toISOString();
  const endISO = end.toISOString();
  const dateKey = startISO.slice(0, 10); // YYYY-MM-DD

  let items = [];
  let ExclusiveStartKey = undefined;

  const filter = STORE_ID
    ? "#createdAt BETWEEN :start AND :end AND #storeId = :storeId"
    : "#createdAt BETWEEN :start AND :end";

  const values = STORE_ID
    ? { ":start": startISO, ":end": endISO, ":storeId": STORE_ID }
    : { ":start": startISO, ":end": endISO };

  // Safer: use ExpressionAttributeNames for reserved words or future conflicts
  const names = {
    "#createdAt": "createdAt",
    "#storeId": "storeId"
  };

  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: filter,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ExclusiveStartKey,
        // Optional: only fetch the attributes we actually use
        ProjectionExpression:
          "createdAt, updatedAt, entityType, requestType, sessionId, sku, requestedSize, requestedColor, #storeId, #status",
        ExpressionAttributeNames: {
          ...names,
          "#status": "status"
        }
      })
    );

    items = items.concat(res.Items || []);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  const sessionMap = new Map();
  const skuCounts = {};
  const sizeCounts = {};
  const colorCounts = {};
  const statusCounts = {};

  let totalRequests = 0;
  let totalScans = 0;
  let fulfillmentSumMs = 0;
  let fulfillmentCount = 0;

  for (const item of items) {
    const entityType = item.entityType || item.requestType || "";
    const sessionId = item.sessionId || "";

    const createdAtMs = item.createdAt ? Date.parse(item.createdAt) : NaN;
    const updatedAtMs = item.updatedAt ? Date.parse(item.updatedAt) : NaN;

    if (sessionId) {
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, { min: null, max: null, scans: 0, requests: 0 });
      }
      const s = sessionMap.get(sessionId);
      if (!Number.isNaN(createdAtMs)) {
        s.min = s.min === null ? createdAtMs : Math.min(s.min, createdAtMs);
        s.max = s.max === null ? createdAtMs : Math.max(s.max, createdAtMs);
      }
    }

    if (entityType === "SCAN") {
      totalScans += 1;
      if (sessionId && sessionMap.has(sessionId)) sessionMap.get(sessionId).scans += 1;
      safeInc(skuCounts, item.sku);
    } else if (entityType === "REQUEST") {
      totalRequests += 1;
      if (sessionId && sessionMap.has(sessionId)) sessionMap.get(sessionId).requests += 1;

      safeInc(sizeCounts, item.requestedSize);
      safeInc(colorCounts, item.requestedColor);
      safeInc(statusCounts, item.status);

      if (item.status === "DELIVERED" && !Number.isNaN(createdAtMs) && !Number.isNaN(updatedAtMs)) {
        fulfillmentSumMs += Math.max(0, updatedAtMs - createdAtMs);
        fulfillmentCount += 1;
      }
    }
  }

  const totalSessions = sessionMap.size;

  let sessionDurationSumMs = 0;
  let sessionDurationCount = 0;

  for (const s of sessionMap.values()) {
    if (s.min !== null && s.max !== null && s.max >= s.min) {
      sessionDurationSumMs += s.max - s.min;
      sessionDurationCount += 1;
    }
  }

  const avgSessionDurationSeconds =
    sessionDurationCount > 0 ? Math.round(sessionDurationSumMs / sessionDurationCount / 1000) : 0;

  const avgRequestFulfillmentSeconds =
    fulfillmentCount > 0 ? Math.round(fulfillmentSumMs / fulfillmentCount / 1000) : 0;

  const avgItemsTriedPerSession =
    totalSessions > 0 ? Math.round((totalScans / totalSessions) * 100) / 100 : 0;

  const conversionRate =
    totalSessions > 0 ? Math.round((totalRequests / totalSessions) * 100) / 100 : 0;

  const topItems = topN(skuCounts, 3);
  const topSizes = topN(sizeCounts, 3);
  const topColors = topN(colorCounts, 3);

  // items_tried is intentionally equal to total_scans for your current model
  const header = [
    "date",
    "store_id",
    "total_sessions",
    "total_scans",
    "total_requests",
    "items_tried",
    "avg_items_tried_per_session",
    "conversion_rate",
    "avg_session_duration_seconds",
    "avg_request_fulfillment_seconds",
    "top_item_1_sku", "top_item_1_count",
    "top_item_2_sku", "top_item_2_count",
    "top_item_3_sku", "top_item_3_count",
    "top_size_1", "top_size_1_count",
    "top_size_2", "top_size_2_count",
    "top_size_3", "top_size_3_count",
    "top_color_1", "top_color_1_count",
    "top_color_2", "top_color_2_count",
    "top_color_3", "top_color_3_count",
    "status_DELIVERED",
    "status_PICKED_UP",
    "status_ON_THE_WAY",
    "status_CANCELLED"
  ];

  const row = [
    dateKey,
    STORE_ID || "ALL",
    totalSessions,
    totalScans,
    totalRequests,
    totalScans,
    avgItemsTriedPerSession,
    conversionRate,
    avgSessionDurationSeconds,
    avgRequestFulfillmentSeconds,
    topItems[0]?.[0] || "", topItems[0]?.[1] || 0,
    topItems[1]?.[0] || "", topItems[1]?.[1] || 0,
    topItems[2]?.[0] || "", topItems[2]?.[1] || 0,
    topSizes[0]?.[0] || "", topSizes[0]?.[1] || 0,
    topSizes[1]?.[0] || "", topSizes[1]?.[1] || 0,
    topSizes[2]?.[0] || "", topSizes[2]?.[1] || 0,
    topColors[0]?.[0] || "", topColors[0]?.[1] || 0,
    topColors[1]?.[0] || "", topColors[1]?.[1] || 0,
    topColors[2]?.[0] || "", topColors[2]?.[1] || 0,
    statusCounts["DELIVERED"] || 0,
    statusCounts["PICKED_UP"] || 0,
    statusCounts["ON_THE_WAY"] || 0,
    statusCounts["CANCELLED"] || 0
  ];

  const csv = `${header.join(",")}\n${row.map(csvEscape).join(",")}\n`;

  const key = STORE_ID
    ? `${PREFIX}/storeId=${STORE_ID}/date=${dateKey}/summary.csv`
    : `${PREFIX}/date=${dateKey}/summary.csv`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: csv,
      ContentType: "text/csv"
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      status: "ok",
      date: dateKey,
      storeId: STORE_ID || "ALL",
      s3Key: key,
      itemCount: items.length
    })
  };
};